export function findServiceCaseInsensitive(services, serviceId) {
  const matched = Object.keys(services).find(key => key.toLowerCase() === serviceId?.toLowerCase());

  return matched ? services[matched] : null;
}
