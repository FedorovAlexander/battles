<script>
	import mapboxgl from 'mapbox-gl';
	import '../../node_modules/mapbox-gl/dist/mapbox-gl.css';
	import { onMount, onDestroy } from 'svelte';
	import doesNotContainPattern from '../utils/stringNotContainPattern';
	import convertDate from '../utils/convertDate';
	import extractCoordinates from '../utils/extractCoordinates';
	import fetchBattlesData from '../utils/fetchBattlesData';
	import closeIcon from '$lib/assets/close.png';

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

	let openSidebar = false;
	let mobile = false;
	let markersCoordinatesArray = [];
	let battleLabelsArray = [];
	let battlesGeoJson = {
		type: 'FeatureCollection',
		features: [],
	};

	onMount(() => {
		const mapboxkey = 'pk.eyJ1IjoiYWxleDIyNDAiLCJhIjoiY2xvMDNjYjFnMTRycDJubzZlc3NnbG56byJ9.fVFXHiJm2WS5M33-4gH20g';
		mapboxgl.accessToken = mapboxkey;
		mobile = window.innerWidth < 600 ? true : false;

		map = new mapboxgl.Map({
			container: 'map',
			style: 'mapbox://styles/alex2240/ckg7oegup5r8k1as4w1ytsrip',
			center: [10.451526, 51.165691],
			zoom: 3.5,
		});

		map.addControl(new mapboxgl.NavigationControl(), 'top-left');

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
				setTimeout(() => {
					addLayers();
				}, 1000);
			});
		});
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});

	function addLayers() {
		map.addSource('battles', {
			type: 'geojson',
			data: battlesGeoJson,
			cluster: true,
			clusterMaxZoom: 14,
			clusterRadius: 50,
		});

		map.addLayer({
			id: 'clusters',
			type: 'circle',
			source: 'battles',
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': ['step', ['get', 'point_count'], '#ffb09c', 100, '#ee2400', 750, '#900000'],
				'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
			},
		});

		map.addLayer({
			id: 'cluster-count',
			type: 'symbol',
			source: 'battles',
			filter: ['has', 'point_count'],
			layout: {
				'text-field': ['get', 'point_count_abbreviated'],
				'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
				'text-size': 12,
			},
		});

		map.addLayer({
			id: 'unclustered-point',
			type: 'circle',
			source: 'battles',
			filter: ['!', ['has', 'point_count']],
			paint: {
				'circle-color': '#ffb09c',
				'circle-radius': 8,
				'circle-stroke-width': 2,
				'circle-stroke-color': '#900000',
			},
		});

		// inspect a cluster on click
		map.on('click', 'clusters', (e) => {
			const features = map.queryRenderedFeatures(e.point, {
				layers: ['clusters'],
			});
			const clusterId = features[0].properties.cluster_id;
			map.getSource('battles').getClusterExpansionZoom(clusterId, (err, zoom) => {
				if (err) return;

				map.easeTo({
					center: features[0].geometry.coordinates,
					zoom: zoom,
				});
			});
		});

		map.on('click', 'unclustered-point', (e) => {
			const coordinates = e.features[0].geometry.coordinates.slice();

			while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
				coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
			}

			currentBattle = {
				title: e.features[0].properties.title,
				date: e.features[0].properties.date,
				startDate: e.features[0].properties.startDate,
				endDate: e.features[0].properties.endDate,
				casualties: e.features[0].properties.casualties,
				description: e.features[0].properties.description,
				image: e.features[0].properties.image,
			};
			fetchDataFromWikipedia(currentBattle.title.replace(/ /g, '_'));
			map.easeTo({
				center: coordinates,
				padding: {
					bottom: mobile ? window.innerHeight / 2 : 0,
					top: 0,
					left: 0,
					right: mobile ? 0 : (window.innerWidth - 150) / 2,
				},
			});
			openSidebar = true;
		});
	}

	function addMarker(data) {
		const coordinates = extractCoordinates(data.coordinates.value);
		if (coordinates) {
			if (!battleLabelsArray.includes(data.battleLabel.value)) {
				battleLabelsArray.push(data.battleLabel.value);
				if (markersCoordinatesArray.includes(coordinates[0])) {
					coordinates[0] += Math.random() * 0.1;
					coordinates[1] += Math.random() * 0.1;
					markersCoordinatesArray.push(coordinates[0]);
					pushGeoJson(data, coordinates);
				} else {
					markersCoordinatesArray.push(coordinates[0]);
					pushGeoJson(data, coordinates);
				}
			}
		}
	}

	function pushGeoJson(data, coordinates) {
		battlesGeoJson.features.push({
			type: 'Feature',
			properties: {
				title: data.battleLabel.value,
				image: data.image ? data.image.value : '',
				startDate: data.startDate ? convertDate(data.startDate.value) : '',
				endDate: data.endDate ? convertDate(data.endDate.value) : '',
				description: data.description ? data.description.value : '',
			},
			geometry: {
				type: 'Point',
				coordinates: coordinates,
			},
		});
	}

	async function fetchDataFromWikipedia(articleTitle) {
		const wikipediaAPI = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&titles=${encodeURIComponent(
			articleTitle
		)}&exintro=1&inprop=url&origin=*`;

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
				const parser = new DOMParser();
				const parsedArticleContent = parser.parseFromString(articleContent, 'text/html');
				const articleContentWithoutTags = parsedArticleContent.body.textContent || '';

				if (articleContent && articleLink) {
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
		openSidebar = false;
		currentBattle = {
			title: '',
			data: '',
			startDate: '',
			endDate: '',
			casualties: '',
			description: '',
			image: '',
			link: '',
		};
	}
</script>

{#if loading}
	<div class="loader-container">
		<div class="loader" />
	</div>
{/if}
<section id="map"></section>

<aside id="sidebar" class:open={openSidebar}>
	<header>
		<button class="close" on:click={closeSidebar} aria-label="Close sidebar">
			<img src={closeIcon} alt="Close sidebar" class="close" />
		</button>
	</header>
	<article class="sidebar-content">
		{#if currentBattle.image}
			<figure class="image-container">
				<img src={currentBattle.image} alt={currentBattle.title} class="image" />
				<figcaption class="image-caption">{currentBattle.title}</figcaption>
			</figure>
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
			<a href={currentBattle.link} target="_blank" rel="noopener noreferrer" class="link">Wikipedia &#x1f517;</a>
		{/if}
		{#if currentBattle.description}
			<p class="description">{currentBattle.description}</p>
		{/if}
	</article>
</aside>

<style>
	@import './+page.css';
</style>
