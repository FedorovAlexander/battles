const doesNotContainPattern = function (inputString) {
	const patternToExclude = /Q\d+/;
	return !patternToExclude.test(inputString);
};

export default doesNotContainPattern;
