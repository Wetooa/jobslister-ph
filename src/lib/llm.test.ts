import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios');
import axios from 'axios';
import { LLMClient } from './llm';

const mockPost = vi.mocked(axios.post);

describe('LLMClient', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockPost.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts to default Ollama endpoint with default model', async () => {
    mockPost.mockResolvedValueOnce({
      data: { response: '{"skills":{}}' },
    });

    const client = new LLMClient();
    await client.generate('hello');

    expect(mockPost).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        model: 'gemma4:31b-cloud',
        prompt: 'hello',
      }),
      expect.any(Object)
    );
  });

  it('uses OLLAMA_API_URL for endpoint', async () => {
    vi.stubEnv('OLLAMA_API_URL', 'https://ollama.example/v1/generate');
    mockPost.mockResolvedValueOnce({ data: { response: '{}' } });

    const client = new LLMClient();
    await client.generate('x');

    expect(mockPost).toHaveBeenCalledWith(
      'https://ollama.example/v1/generate',
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('uses OLLAMA_HOST to build /api/generate URL', async () => {
    vi.stubEnv('OLLAMA_HOST', 'http://host.docker.internal:11434');
    mockPost.mockResolvedValueOnce({ data: { response: '{}' } });

    const client = new LLMClient();
    await client.generate('x');

    expect(mockPost).toHaveBeenCalledWith(
      'http://host.docker.internal:11434/api/generate',
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('uses OLLAMA_MODEL when set', async () => {
    vi.stubEnv('OLLAMA_MODEL', 'custom-model');
    mockPost.mockResolvedValueOnce({ data: { response: '{}' } });

    const client = new LLMClient();
    await client.generate('x');

    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'custom-model' }),
      expect.any(Object)
    );
  });

  it('retries once on 429 then succeeds', async () => {
    vi.useFakeTimers();
    mockPost
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce({ data: { response: '{"ok":true}' } });

    const client = new LLMClient('m', 'http://localhost/api/generate');
    const pending = client.generate('p');

    await vi.advanceTimersByTimeAsync(5000);
    const out = await pending;

    expect(out).toBe('{"ok":true}');
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('throws on non-429 errors with status detail', async () => {
    mockPost.mockRejectedValue({
      message: 'fail',
      response: { status: 500, data: 'server error' },
    });

    const client = new LLMClient('m', 'http://localhost/api/generate');

    await expect(client.generate('x')).rejects.toThrow(/Status 500/);
  });

  it('throws after max 429 retries', async () => {
    vi.useFakeTimers();
    mockPost.mockRejectedValue({ response: { status: 429 } });

    const client = new LLMClient('m', 'http://localhost/api/generate');
    const pending = client.generate('x');

    const assertion = expect(pending).rejects.toThrow(
      /Max retry attempts reached/
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('compareJob parses JSON and normalizes match_score', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        response: JSON.stringify({
          match_score: 80,
          pros: ['a'],
          cons: [],
          recommendation: 'Apply',
          reasoning: 'ok',
        }),
      },
    });

    const client = new LLMClient('m', 'http://localhost/api/generate');
    const result = await client.compareJob(
      { skills: {}, projects: [] },
      'job text'
    );

    if ('matchScore' in result && !('error' in result)) {
      expect(result.matchScore).toBe(80);
    } else {
      throw new Error('expected analysis');
    }
  });
});
