function qaTitle(scenario) {
  if (typeof scenario !== 'string' || !scenario.trim()) throw new Error('QA scenario name is required');
  return `QA-AT ${scenario.trim()} ${new Date().toISOString()} ${process.pid}`;
}
module.exports = { qaTitle };
