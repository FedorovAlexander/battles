<script>
	import mapboxgl from 'mapbox-gl';
	import '../../node_modules/mapbox-gl/dist/mapbox-gl.css';
	import { onMount, onDestroy } from 'svelte';

	let map;

	onMount(() => {
		const mapboxkey = 'pk.eyJ1IjoiYWxleDIyNDAiLCJhIjoiY2xvMDNjYjFnMTRycDJubzZlc3NnbG56byJ9.fVFXHiJm2WS5M33-4gH20g';
		mapboxgl.accessToken = mapboxkey;

		map = new mapboxgl.Map({
			container: 'map',
			style: 'mapbox://styles/mapbox/streets-v11',
			center: [10.451526, 51.165691],
			zoom: 1,
		});

		map.on('load', () => {
			fetchBattlesData().then((data) => {
				data.results.bindings.forEach((battle) => {
					if (battle.latitude && battle.longitude) {
						addMarker(battle);
					}
				});
			});
		});
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});

	async function fetchBattlesData() {
		const sparqlQuery = `
		SELECT ?battle ?battleLabel ?date ?startDate ?endDate ?latitude ?longitude ?casualties ?image
		WHERE {
				?battle wdt:P31 wd:Q178561.
				OPTIONAL { ?battle wdt:P585 ?date. }
				OPTIONAL { ?battle wdt:P580 ?startDate. }
				OPTIONAL { ?battle wdt:P582 ?endDate. }
				OPTIONAL { ?battle wdt:P625 ?coordinates. }
				OPTIONAL {
						?battle wdt:P625 ?coord.
						BIND (xsd:double(SUBSTR(str(?coord), 7, 10)) AS ?longitude).
						BIND (xsd:double(SUBSTR(str(?coord), 18, 10)) AS ?latitude).
				}
				OPTIONAL { ?battle wdt:P1120 ?casualties. }
				OPTIONAL { ?battle wdt:P18 ?image. }
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
	}

	function addMarker(data) {
		const el = document.createElement('div');
		el.className = 'marker';
		el.style.backgroundColor = '#ff0000';
		el.style.width = '10px';
		el.style.height = '10px';
		el.style.borderRadius = '50%';
		el.addEventListener('click', () => {
			console.log(data);
		});

		const coordinates = data.latitude && data.longitude ? [data.longitude.value, data.latitude.value] : null;
		if (coordinates) {
			const marker = new mapboxgl.Marker(el).setLngLat(coordinates).addTo(map);
		} else {
			console.log('no coordinates', data);
		}
	}
</script>

<div id="map" />

<style>
	#map {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;
	}
</style>
