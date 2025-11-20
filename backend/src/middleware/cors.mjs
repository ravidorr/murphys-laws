export function getCorsOrigin(req, allowedOrigins) {
  // If wildcard is allowed, return it
  if (allowedOrigins.includes('*')) {
    return '*';
  }

  // Get the origin from the request
  const requestOrigin = req.headers.origin;

  // If no origin in request or origin not in allowed list, use first allowed origin as fallback
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return allowedOrigins[0] || '*';
  }

  // Return the matching allowed origin
  return requestOrigin;
}
