function isValidCommaDelimitedList(value) {
  // allow letters, commas, and spaces
  const commaDelimitedListRegEx = /^[A-Za-z,\s]+$/;
  return commaDelimitedListRegEx.test(value);
}

function isValidTagmode(value) {
  return value === 'all' || value === 'any';
}

function hasValidFlickrAPIParams(tags, tagmode) {
  console.log('Tags:', tags);
  console.log('Tagmode:', tagmode);
  return isValidCommaDelimitedList(tags) && isValidTagmode(tagmode);
}

module.exports = {
  isValidCommaDelimitedList,
  isValidTagmode,
  hasValidFlickrAPIParams
};
