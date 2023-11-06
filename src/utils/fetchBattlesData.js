const fetchBattlesData = async function () {
	const sparqlQuery = `
		SELECT ?battle ?battleLabel ?date ?startDate ?endDate ?coordinates ?casualties ?image ?partOf
		WHERE {
				?battle wdt:P31 wd:Q178561.
				OPTIONAL { ?battle wdt:P585 ?date. }
				OPTIONAL { ?battle wdt:P580 ?startDate. }
				OPTIONAL { ?battle wdt:P582 ?endDate. }
				OPTIONAL { ?battle wdt:P625 ?coordinates. }
				OPTIONAL { ?battle wdt:P1120 ?casualties. }
				OPTIONAL { ?battle wdt:P18 ?image. }
				OPTIONAL { ?battle wdt:P361 ?partOf. }
				SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
		}
	`;

	const endpoint = 'https://query.wikidata.org/sparql';
	const url = endpoint + '?query=' + encodeURIComponent(sparqlQuery) + '&format=json';

	try {
		const response = await fetch(url, { method: 'GET' });
		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Error fetching data:', error);
	}
};
export default fetchBattlesData;
