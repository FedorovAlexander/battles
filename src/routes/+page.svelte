<script>
	import mapboxgl from 'mapbox-gl';
	import '../../node_modules/mapbox-gl/dist/mapbox-gl.css';
	import { onMount, onDestroy } from 'svelte';
	import doesNotContainPattern from '../utils/stringNotContainPattern';
	import convertDate from '../utils/convertDate';
	import extractCoordinates from '../utils/extractCoordinates';

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
		link: '',
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
			};
			//get data from wiki api replace spaces with underscores
			fetchDataFromWikipedia(data.battleLabel.value.replace(/ /g, '_'));

			document.getElementById('sidebar').style.right = '0';
		});

		const coordinates = extractCoordinates(data.coordinates.value);
		if (coordinates) {
			const marker = new mapboxgl.Marker(el).setLngLat(coordinates).addTo(map);
		} else {
			console.log('no coordinates', data);
		}
	}

	async function fetchDataFromWikipedia(articleTitle) {
		// Replace with the Wikipedia API endpoint
		const wikipediaAPI = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&titles=${encodeURIComponent(
			articleTitle
		)}&exintro=1&inprop=url&origin=*`;

		// Make a GET request to the Wikipedia API
		fetch(wikipediaAPI)
			.then((response) => {
				if (!response.ok) {
					throw new Error('Network response was not ok');
				}
				return response.json();
			})
			.then((data) => {
				const pages = data.query.pages;
				const firstPageId = Object.keys(pages)[0];
				const article = pages[firstPageId];
				const articleContent = article.extract;
				const articleLink = article.fullurl;

				//parse article content and remove html tags
				const parser = new DOMParser();
				const parsedArticleContent = parser.parseFromString(articleContent, 'text/html');
				const articleContentWithoutTags = parsedArticleContent.body.textContent || '';

				if (articleContent && articleLink) {
					// You can do something with the article content and link here
					currentBattle.description = articleContentWithoutTags;
					currentBattle.link = articleLink;
				} else {
					console.log('Article not found');
				}
			})
			.catch((error) => {
				console.error('Error:', error);
			});
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
			<img src="https://placehold.jp/30/d3d3d3/ffffff/300x200.png?text=no+image" alt={currentBattle.title} ariaclass="image" class="image" />
		</div>
	{/if}
	<h2 class="title">{currentBattle.title}</h2>
	{#if currentBattle.startDate}
		{#if currentBattle.endDate}
			<p class="date">{currentBattle.startDate} - {currentBattle.endDate}</p>
		{:else}
			<p class="date">{currentBattle.startDate}</p>
		{/if}
	{/if}
	{#if currentBattle.link}
		<a href={currentBattle.link} target="”_blank”" noopener noreferrer class="link">Article in Wikipedia</a>
	{/if}
	{#if currentBattle.description}
		<p class="description">{currentBattle.description}</p>
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
		max-height: fit-content;
		min-height: 300px;
		display: flex;
		justify-content: center;
	}
	.image {
		width: auto;
		max-height: 300px;
	}

	.close {
		position: absolute;
		top: 0;
		right: 0;
		width: 30px;
		height: 30px;
		font-size: 30px;
		margin: 0;
		padding: 0;
		color: lightgray !important;
		border: none;
		background-color: transparent;
		cursor: pointer;
		line-height: 30px;
	}

	.title {
		font-size: 20px;
		margin: 10px 0px 5px;
		padding: 10px;
		color: #111;
	}

	.date {
		font-size: 14px;
		margin: 10px 0 0;
		padding: 10px;
		color: #111;
	}

	.description {
		font-size: 14px;
		margin: 10px 0 20px;
		padding: 10px;
		color: #111;
	}

	.link {
		font-size: 14px;
		margin: 0;
		padding: 10px;
		color: darkslategray;
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
