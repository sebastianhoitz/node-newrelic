'use strict';

var path          = require('path')
  , Metrics       = require(path.join(__dirname, '..', 'metric', 'metrics'))
  , Trace         = require(path.join(__dirname, '..', 'trace-nu'))
  , Timer         = require(path.join(__dirname, '..', 'timer'))
  ;

/**
 * Bundle together the metrics and the trace probes for a single agent
 * transaction.
 *
 * @param {Object} agent The agent.
 */
function Transaction(agent) {
  if (!agent) throw new Error('every transaction must be bound to the agent');

  this.timer = new Timer();
  this.timer.begin();

  this.agent = agent;

  var apdexT = (agent.metrics) ? agent.metrics.apdexT : 0;
  var renamer = (agent.metrics) ? agent.metrics.renamer : null;
  this.metrics = new Metrics(renamer, apdexT);
}

/**
 * Associate a transaction with a URL and mark it as a web transaction.
 *
 * @param {string} url The URL for this transaction.
 */
Transaction.prototype.setURL = function (url) {
  this.url = url;
};

/**
 * Add a clear API method for determining whether a transaction is web or
 * background.
 *
 * @returns {boolean} Whether this transaction has a URL.
 */
Transaction.prototype.isWeb = function () {
  return this.url ? true : false;
};

/**
 * Return the associated transaction trace, creating it if necessary.
 */
Transaction.prototype.getTrace = function () {
  if (!this.trace) this.trace = new Trace(this);

  return this.trace;
};

/**
 * Close out the current transaction, recursively ending any still-open
 * traces on the transaction (FIXME: when better asynchronous support is
 * available in core, not necessary to hard-stop the transaction, although
 * it makes it tough to know when to harvest the transaction).
 */
Transaction.prototype.end = function () {
  if (!this.timer.isActive()) return;

  // FIXME: what are we using this timer for?
  this.timer.end();

  if (this.trace) this.trace.end();

  this.agent.emit('transactionFinished', this.metrics);
};

/**
 * @return {bool} Is this transaction still alive?
 */
Transaction.prototype.isActive = function () {
  return this.timer.isActive();
};

/**
 * Open a new trace.
 *
 * @param {string} name The name of the metric to gather.
 * @param {string} scope (optional) Scope to which the metric is bound.
 */
Transaction.prototype.measure = function (name, scope, duration, exclusiveDuration) {
  // throwing is unsafe in asynchronous contexts, so silently return
  if (!this.timer.isActive()) return;

  var metric = this.metrics.getOrCreateMetric(name, scope);
  metric.stats.recordValueInMillis(duration, exclusiveDuration);

  return metric;
};

/**
 * Look up metrics for a transaction.
 *
 * @param {string} name The name of the metric.
 * @param {string} scope (optional) Scope to which the metric is bound.
 * @returns {Array} Relevant metric.
 */
Transaction.prototype.getMetrics = function (name, scope) {
  return this.metrics.getMetric(name, scope);
};

module.exports = Transaction;