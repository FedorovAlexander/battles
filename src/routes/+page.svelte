<script>
	import mapboxgl from 'mapbox-gl';
	import '../../node_modules/mapbox-gl/dist/mapbox-gl.css';
	import { onMount, onDestroy } from 'svelte';

	let map;
	let loading = true;
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
					if (battle.coordinates) {
						if (doesNotContainPattern(battle.battleLabel.value)) {
							addMarker(battle);
						}
					}
					loading = false;
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
	}

	function extractCoordinates(input) {
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
	}

	function addMarker(data) {
		const el = document.createElement('div');
		el.className = 'marker';
		el.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
		el.style.width = '8px';
		el.style.height = '8px';
		el.style.borderRadius = '50%';
		el.addEventListener('click', () => {
			currentBattle = {
				title: data.battleLabel.value,
				date: data.date ? convertDate(data.date.value) : '',
				startDate: data.startDate ? convertDate(data.startDate.value) : '',
				endDate: data.endDate ? convertDate(data.endDate.value) : '',
				casualties: data.casualties ? data.casualties.value : '',
				description: data.description ? data.description.value : '',
				image: data.image ? data.image.value : '',
				partOf: data.partOf ? data.partOf.value : '',
			};
			console.log(currentBattle);
			console.log(data);
			document.getElementById('sidebar').style.right = '0';
		});

		const coordinates = extractCoordinates(data.coordinates.value);
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

	function convertDate(date) {
		//convert date to April 1, 2020 format
		const dateObj = new Date(date);
		const month = dateObj.toLocaleString('default', { month: 'long' });
		const day = dateObj.getDate();
		const year = dateObj.getFullYear();
		return `${month} ${day}, ${year}`;
	}

	function closeSidebar() {
		document.getElementById('sidebar').style.right = '-300px';
	}
</script>

{#if loading}
	<div class="loader-container">
		<div class="loader" />
	</div>
{/if}
<div id="map" />
<div id="sidebar">
	<button class="close" on:click={closeSidebar}>&#128473;</button>
	{#if currentBattle.image}
		<div class="image-container">
			<img src={currentBattle.image} alt={currentBattle.title} ariaclass="image" class="image" />
		</div>
	{:else}
		<div class="image-container">
			<img src="https://placehold.jp/30/dd6699/ffffff/300x200.png?text=no+image" alt={currentBattle.title} ariaclass="image" class="image" />
		</div>
	{/if}
	<h2 class="title">{currentBattle.title}</h2>
	{#if currentBattle.startDate}
		{#if currentBattle.endDate}
			<p class="date">Date: {currentBattle.startDate} - {currentBattle.endDate}</p>
		{:else}
			<p class="date">Date: {currentBattle.startDate}</p>
		{/if}
	{/if}
	{#if currentBattle.partOf}
		<p class="partOf">Part of: {currentBattle.partOf}</p>
	{/if}
	{#if currentBattle.casualties}
		<p class="casualties">Number of deaths: {currentBattle.casualties}</p>
	{/if}
	{#if currentBattle.description}
		<p class="description">Description: {currentBattle.description}</p>
	{/if}
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

	.image-container {
		width: 100%;
		min-height: 300px;
		max-height: 300px;
		display: flex;
		justify-content: center;
	}
	.image {
		width: 100%;
		max-height: 300px;
	}

	.close {
		position: absolute;
		top: 0;
		right: 0;
		width: 30px;
		height: 30px;
		font-size: 18px;
		margin: 0;
		padding: 0;
		color: lightgray !important;
		border: none;
		background-color: transparent;
	}

	.loader-container {
		position: absolute;
		z-index: 100;
		top: calc(50% - 60px);
		left: calc(50% - 60px);
	}
	.loader {
		border: 16px solid #f3f3f3; /* Light grey */
		border-top: 16px solid #3498db; /* Blue */
		border-radius: 50%;
		width: 120px;
		height: 120px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
