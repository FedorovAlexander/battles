const extractCoordinates = function (input) {
	// Match the numbers using a regular expression
	const matches = input.match(/-?\d+\.\d+/g);

	// Check if there are at least two matches (latitude and longitude)
	if (matches && matches.length >= 2) {
		const latitude = parseFloat(matches[0]);
		const longitude = parseFloat(matches[1]);
		return [latitude, longitude];
	} else {
		return null; // Return null or handle the error as needed
	}
};

export default extractCoordinates;
