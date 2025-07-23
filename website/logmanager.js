export class LogManager {
  constructor(displayElementId, maxEntries = 50) {
    this.logs = [];
    this.displayElement = document.getElementById(displayElementId)
    this.maxEntries = maxEntries;
  }

  addLog(message, type='info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      type,
      id: Date.now() + Math.random()
    };

    this.logs.push(logEntry);

    if (this.logs.length > this.maxEntries) {
      this.logs.shift()
    }

    this.updateDisplay();
  }

  updateDisplay() {
    if (!this.displayElement) return;

    const recentLogs = this.logs.slice(-15);
    const html = recentLogs.map(log =>
      `<div class="log-entry log-${log.type}">
        <span class="timestamp">${log.timestamp}</span>
        <span class="message">${log.message}</span>
      </div>`
    ).join('');

    this.displayElement.innerHTML = html;
    this.displayElement.scrollTop = this.displayElement.scrollHeight;
  }
};
