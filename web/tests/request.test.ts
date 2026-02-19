// @ts-nocheck
import { apiRequest, apiGet, apiPost, apiDelete } from '../src/utils/request.ts';
import { API_BASE_URL } from '../src/utils/constants.ts';

describe('request utilities', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('apiRequest', () => {
    it('makes GET request to primary URL by default', async () => {
      const mockData = { data: 'test' };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      });

      const result = await apiRequest('/api/test');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json'
          })
        })
      );
      expect(result).toEqual(mockData);
    });

    it('makes POST request with body', async () => {
      const mockData = { success: true };
      const requestBody = { name: 'test' };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      });

      const result = await apiRequest('/api/test', {
        method: 'POST',
        body: requestBody
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(requestBody)
        })
      );
      expect(result).toEqual(mockData);
    });

    it('makes DELETE request', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      await apiRequest('/api/test', { method: 'DELETE' });

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('includes custom headers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
      });

      await apiRequest('/api/test', {
        headers: { 'X-Custom-Header': 'value' }
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'X-Custom-Header': 'value'
          })
        })
      );
    });

    it('throws error on network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('Network failed'));

      await expect(apiRequest('/api/test')).rejects.toThrow('Network error');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error when API returns non-ok response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' })
      });

      await expect(apiRequest('/api/test')).rejects.toThrow('Server error');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('handles non-JSON responses with error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => { throw new Error('Not JSON'); }
      });

      await expect(apiRequest('/api/test'))
        .rejects.toThrow('The requested resource was not found');
    });

    it('throws error when response is OK but JSON parsing fails', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(apiRequest('/api/test'))
        .rejects.toThrow('Invalid response from server. Please try again.');
    });

    it('handles 404 error responses', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Law not found' })
      });

      await expect(apiRequest('/api/test'))
        .rejects.toThrow('Law not found');
    });

    it('handles 500 error responses', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' })
      });

      await expect(apiRequest('/api/test'))
        .rejects.toThrow('Server error');
    });

    it('handles 429 rate limit error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => { throw new Error('Not JSON'); }
      });

      await expect(apiRequest('/api/test'))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('handles 401 unauthorized error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => { throw new Error('Not JSON'); }
      });

      await expect(apiRequest('/api/test'))
        .rejects.toThrow('do not have permission');
    });

    it('handles 403 forbidden error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => { throw new Error('Not JSON'); }
      });

      await expect(apiRequest('/api/test'))
        .rejects.toThrow('do not have permission');
    });

    it('handles 400 bad request error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => { throw new Error('Not JSON'); }
      });

      await expect(apiRequest('/api/test'))
        .rejects.toThrow('Invalid request');
    });
  });

  describe('apiGet', () => {
    it('makes GET request', async () => {
      const mockData = { data: 'test' };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      });

      const result = await apiGet('/api/test');

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockData);
    });

    it('passes query parameters', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
      });

      await apiGet('/api/test', { q: 'search', limit: '10' });

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test?q=search&limit=10`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('apiPost', () => {
    it('makes POST request with body', async () => {
      const mockData = { id: 1, created: true };
      const requestBody = { name: 'test' };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockData
      });

      const result = await apiPost('/api/test', requestBody);

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual(mockData);
    });

    it('handles null body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
      });

      await apiPost('/api/test', null);

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.not.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      // Verify body is not included when null
      expect(fetchSpy.mock.calls[0][1]).not.toHaveProperty('body');
    });
  });

  describe('apiDelete', () => {
    it('makes DELETE request', async () => {
      const mockData = { success: true };
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      });

      const result = await apiDelete('/api/test');

      expect(fetchSpy).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/test`,
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toEqual(mockData);
    });

    it('throws error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiDelete('/api/test')).rejects.toThrow('Network error');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
