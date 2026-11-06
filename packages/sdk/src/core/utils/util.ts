export function generateIdFromDate(date: Date = new Date()): string {
  return (typeof date === 'string' ? new Date(date) : date).getTime().toString(36);
}

export function sortByName(data: any[]): any[] {
  return data.slice().sort((a, b) => parseFloat(a) > parseFloat(b) ? 1 : -1);
}

export function sortByDate(data: any[]): any[] {
  return data.slice().sort((a, b) => new Date(a.date).getTime() > new Date(b.date).getTime() ? 1 : -1);
}

function prefixWithZero(num: number): string {
  return `${num < 10 ? '0' + num : num}`;
}

export function convertDateFormat(date: Date, zone?: string): string {
  return `${[date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => prefixWithZero(n)).join('-')} ${[date.getHours(), date.getMinutes(), date.getSeconds()].map(n => prefixWithZero(n)).join(':')} ${zone || '+0800'}`;
}
