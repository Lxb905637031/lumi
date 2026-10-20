export function normalizeEnvelope(body) {
  return body && body.success === true ? body.data : body;
}
