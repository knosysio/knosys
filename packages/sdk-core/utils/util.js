function generateIdFromDate(date = new Date) {
  return (typeof date === 'string' ? new Date(date) : date).getTime().toString(36);
}

function sortByName(data) {
  return data.slice().sort((a, b)=> parseFloat(a) > parseFloat(b) ? 1 : -1);
}

function sortByDate(data) {
  return data.slice().sort((a, b) => (new Date(a.date)).getTime() > (new Date(b.date)).getTime() ? 1 : -1);
}

function prefixWithZero(num) {
  return `${num < 10 ? '0' + num : num}`;
}

function convertDateFormat(date, zone) {
  return `${[date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => prefixWithZero(n)).join('-')} ${[date.getHours(), date.getMinutes(), date.getSeconds()].map(n => prefixWithZero(n)).join(':')} ${zone || '+0800'}`;
}

module.exports = {
  generateIdFromDate,
  sortByName,
  sortByDate,
  convertDateFormat,
};
