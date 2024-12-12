export function sanitizeData(data: any) {
  const clean = { ...data };
  delete clean._rev;
  delete clean._attachments;
  delete clean._deleted;
  delete clean._meta;
  return clean;
}