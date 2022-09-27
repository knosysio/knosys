function sortByName(data) {
  return data.slice().sort((a, b)=> parseFloat(a) > parseFloat(b) ? 1 : -1);
}

module.exports = { sortByName };
