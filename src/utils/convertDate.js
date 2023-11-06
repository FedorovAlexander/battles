const convertDate = function (date) {
	//convert date to April 1, 2020 format
	const dateObj = new Date(date);
	const month = dateObj.toLocaleString('default', { month: 'long' });
	const day = dateObj.getDate();
	const year = dateObj.getFullYear();
	return `${month} ${day}, ${year}`;
};

export default convertDate;
