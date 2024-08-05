<script>
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { onMount, onDestroy } from 'svelte';
	import doesNotContainPattern from '../utils/stringNotContainPattern';
	import convertDate from '../utils/convertDate';
	import extractCoordinates from '../utils/extractCoordinates';
	import fetchBattlesData from '../utils/fetchBattlesData';
	import closeIcon from '$lib/assets/close.svg';
	import COLOR_CONSTANTS from '../utils/colorConstants';
	import MAPBOX_CONFIG from '../utils/mapboxConfig';

	let map;
	let loading = true;
	let currentBattle = getDefaultBattle();
	let openSidebar = false;
	let mobile = false;
	let mobileBreakpoint = 600;
	let markersCoordinatesArray = [];
	let battleLabelsArray = [];
	let battlesGeoJson = {
		type: 'FeatureCollection',
		features: [],
	};

	onMount(async () => {
		mapboxgl.accessToken = MAPBOX_CONFIG.accessToken;

		mobile = window?.innerWidth < mobileBreakpoint;

		initializeMap();

		map.on('load', async () => {
			const data = await fetchBattlesData();
			processBattleData(data.results.bindings);
			loading = false;
			setTimeout(addLayers, 1000);
		});
	});

	onDestroy(() => {
		map?.remove();
	});

	function initializeMap() {
		map = new mapboxgl.Map({
			container: 'map',
			style: MAPBOX_CONFIG.style,
			center: MAPBOX_CONFIG.initialCenter,
			zoom: MAPBOX_CONFIG.initialZoom,
		});

		map.addControl(new mapboxgl.NavigationControl(), 'top-left');
	}

	async function processBattleData(battles) {
		for (const battle of battles) {
			if (battle.coordinates && doesNotContainPattern(battle.battleLabel.value)) {
				addMarker(battle);
			}
		}
	}

	function addLayers() {
		map.addSource('battles', {
			type: 'geojson',
			data: battlesGeoJson,
			cluster: true,
			clusterMaxZoom: MAPBOX_CONFIG.clusterMaxZoom,
			clusterRadius: MAPBOX_CONFIG.clusterRadius,
		});

		map.addLayer({
			id: 'clusters',
			type: 'circle',
			source: 'battles',
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': [
					'step',
					['get', 'point_count'],
					COLOR_CONSTANTS.markerPointLight,
					MAPBOX_CONFIG.clusterFirstStep,
					COLOR_CONSTANTS.markerPointDark,
					MAPBOX_CONFIG.clusterSecondStep,
					COLOR_CONSTANTS.markerPointDarkest,
				],
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
				'text-font': MAPBOX_CONFIG.textFont,
				'text-size': MAPBOX_CONFIG.textSize,
			},
		});

		map.addLayer({
			id: 'unclustered-point',
			type: 'circle',
			source: 'battles',
			filter: ['!', ['has', 'point_count']],
			paint: {
				'circle-color': COLOR_CONSTANTS.markerPointLight,
				'circle-radius': MAPBOX_CONFIG.pointCircleRadius,
				'circle-stroke-width': MAPBOX_CONFIG.pointCircleStrokeWidth,
				'circle-stroke-color': COLOR_CONSTANTS.markerPointDarkest,
			},
		});

		map.on('click', 'clusters', handleClusterClick);
		map.on('click', 'unclustered-point', handleUnclusteredPointClick);
	}

	function handleClusterClick(e) {
		const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
		const clusterId = features[0].properties.cluster_id;

		map.getSource('battles').getClusterExpansionZoom(clusterId, (err, zoom) => {
			if (err) return;

			map.easeTo({
				center: features[0].geometry.coordinates,
				zoom: zoom,
			});
		});
	}

	async function handleUnclusteredPointClick(e) {
		const coordinates = adjustCoordinates(e.features[0].geometry.coordinates, e.lngLat.lng);

		currentBattle = extractBattleData(e.features[0].properties);
		await fetchDataFromWikipedia(currentBattle.title.replace(/ /g, '_'));

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
	}

	function adjustCoordinates(coordinates, lng) {
		while (Math.abs(lng - coordinates[0]) > 180) {
			coordinates[0] += lng > coordinates[0] ? 360 : -360;
		}
		return coordinates;
	}

	function extractBattleData(properties) {
		return {
			title: properties.title,
			date: properties.date,
			startDate: properties.startDate,
			endDate: properties.endDate,
			casualties: properties.casualties,
			description: properties.description,
			image: properties.image,
		};
	}

	function addMarker(data) {
		const coordinates = extractCoordinates(data.coordinates.value);
		if (!coordinates || battleLabelsArray.includes(data.battleLabel.value)) return;

		battleLabelsArray.push(data.battleLabel.value);
		if (markersCoordinatesArray.includes(coordinates[0])) {
			coordinates[0] += Math.random() * 0.1;
			coordinates[1] += Math.random() * 0.1;
		}
		markersCoordinatesArray.push(coordinates[0]);
		pushGeoJson(data, coordinates);
	}

	function pushGeoJson(data, coordinates) {
		battlesGeoJson.features.push({
			type: 'Feature',
			properties: {
				title: data.battleLabel.value,
				image: data.image?.value || '',
				startDate: data.startDate ? convertDate(data.startDate.value) : '',
				endDate: data.endDate ? convertDate(data.endDate.value) : '',
				description: data.description?.value || '',
			},
			geometry: {
				type: 'Point',
				coordinates: coordinates,
			},
		});
	}

	async function fetchDataFromWikipedia(articleTitle) {
		const wikipediaAPI = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&titles=${encodeURIComponent(articleTitle)}&exintro=1&inprop=url&origin=*`;

		try {
			const response = await fetch(wikipediaAPI);
			if (!response.ok) throw new Error('Network response was not ok');

			const data = await response.json();
			const article = Object.values(data.query.pages)[0];
			const articleContent = article.extract;
			const articleLink = article.fullurl;

			const parser = new DOMParser();
			const parsedArticleContent = parser.parseFromString(articleContent, 'text/html');
			const articleContentWithoutTags = parsedArticleContent.body.textContent || '';

			if (articleContent && articleLink) {
				currentBattle.description = articleContentWithoutTags;
				currentBattle.link = articleLink;
			}
		} catch (error) {
			console.error('Error:', error);
		}
	}

	function closeSidebar() {
		openSidebar = false;
		currentBattle = getDefaultBattle();
	}

	function getDefaultBattle() {
		return {
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
			<p class="date">
				{currentBattle.startDate}
				{#if currentBattle.endDate}
					- {currentBattle.endDate}
				{/if}
			</p>
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
