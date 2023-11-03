<script>
	import mapboxgl from 'mapbox-gl';
	import '../../node_modules/mapbox-gl/dist/mapbox-gl.css';
	import { onMount, onDestroy } from 'svelte';

	let map;
	let currentBattle = {
		title: '',
		data: '',
		startDate: '',
		endDate: '',
		casualties: '',
		description: '',
		image: '',
		partOf: '',
	};

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
						console.log;
						if (doesNotContainPattern(battle.battleLabel.value)) {
							addMarker(battle);
						}
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
		SELECT ?battle ?battleLabel ?date ?startDate ?endDate ?latitude ?longitude ?casualties ?image ?partOf
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
	}

	function addMarker(data) {
		const el = document.createElement('div');
		el.className = 'marker';
		el.style.backgroundColor = '#ff0000';
		el.style.width = '10px';
		el.style.height = '10px';
		el.style.borderRadius = '50%';
		el.addEventListener('click', () => {
			currentBattle = {
				title: data.battleLabel.value,
				startDate: data.startDate ? data.startDate.value : '',
				endDate: data.endDate ? data.endDate.value : '',
				casualties: data.casualties ? data.casualties.value : '',
				description: data.description ? data.description.value : '',
				image: data.image ? data.image.value : '',
				partOf: data.partOf ? data.partOf.value : '',
			};
			console.log(currentBattle);
			console.log(data);
			document.getElementById('sidebar').style.right = '0';
		});

		const coordinates = data.latitude && data.longitude ? [data.longitude.value, data.latitude.value] : null;
		if (coordinates) {
			const marker = new mapboxgl.Marker(el).setLngLat(coordinates).addTo(map);
		} else {
			console.log('no coordinates', data);
		}
	}

	function doesNotContainPattern(inputString) {
		const patternToExclude = /Q\d+/;
		return !patternToExclude.test(inputString);
	}
	function closeSidebar() {
		document.getElementById('sidebar').style.right = '-300px';
	}
</script>

<div id="map" />
<div id="sidebar">
	<span class="close" on:click={closeSidebar}>x</span>
	<img src={currentBattle.image} alt={currentBattle.title} class="image" />
	<h2 class="title">{currentBattle.title}</h2>
	<p class="date">{currentBattle.description}</p>
	<p class="casualties">{currentBattle.casualties}</p>
	<p class="description">{currentBattle.description}</p>
</div>

<style>
	#map {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;
	}

	#sidebar {
		font-family: Arial, Helvetica, sans-serif;
		position: absolute;
		top: 0;
		right: -300px;
		width: 300px;
		height: 100%;
		background-color: #fff;
		overflow: auto;
		transition: right 0.3s ease-in-out;
	}

	.image {
		width: 100%;
	}

	.close {
		position: absolute;
		top: 0;
		right: 0;
		width: 30px;
		height: 30px;
		font-size: 30px;
		background-color: transparent;
		content: 'x';
	}
</style>
