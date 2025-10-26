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
	let sidebarLoading = false;
	let currentBattle = getDefaultBattle();
	let openSidebar = false;
	let mobile = false;
	let mobileBreakpoint = 600;
	let coordinateCounts = new Map();
	let battleLabelsArray = [];
	let battlesGeoJson = {
		type: 'FeatureCollection',
		features: [],
	};

	let dropdownItems = [];

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
		if (!mobile) {
			map.addControl(new mapboxgl.NavigationControl(), MAPBOX_CONFIG.navigationControlPosition);
		}
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
		sidebarLoading = true;
		openSidebar = true;
		if (currentBattle.wikidataId) {
			await fetchDataFromWikipediaViaWikidata(currentBattle.wikidataId);
		} else {
			// Fallback to title search if no Wikidata ID
			await fetchDataFromWikipedia(currentBattle.title.replace(/ /g, '_'));
		}
		sidebarLoading = false;

		map.easeTo({
			center: coordinates,
			padding: {
				bottom: mobile ? window.innerHeight / 2 : 0,
				top: 0,
				left: 0,
				right: mobile ? 0 : (window.innerWidth - 150) / 2,
			},
		});

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
			wikidataId: properties.wikidataId,
		};
	}

	function addMarker(data) {
		const coordinates = extractCoordinates(data.coordinates.value);
		if (!coordinates || battleLabelsArray.includes(data.battleLabel.value)) return;

		battleLabelsArray.push(data.battleLabel.value);
		const key = getCoordinateKey(coordinates);
		const existingCount = coordinateCounts.get(key) || 0;
		if (existingCount > 0) {
			const jittered = getJitteredCoordinates(coordinates, existingCount);
			coordinates[0] = jittered[0];
			coordinates[1] = jittered[1];
		}
		coordinateCounts.set(key, existingCount + 1);
		pushGeoJson(data, coordinates);
	}

	function getCoordinateKey(coords) {
		// coords expected as [lng, lat]
		const lng = Number.parseFloat(coords[0]).toFixed(5);
		const lat = Number.parseFloat(coords[1]).toFixed(5);
		return `${lng},${lat}`;
	}

	function getJitteredCoordinates(baseCoords, index) {
		// Deterministic small spiral jitter to separate exact duplicates visually
		const lng = baseCoords[0];
		const lat = baseCoords[1];
		const goldenAngle = 137.508 * (Math.PI / 180);
		const theta = index * goldenAngle;
		// radius in degrees (~0.003 deg ~ 300-350m); grow slowly with sqrt(index)
		const radius = 0.003 * Math.sqrt(index);
		const dLat = radius * Math.cos(theta);
		const latRad = lat * Math.PI / 180;
		const dLng = (radius * Math.sin(theta)) / Math.max(0.1, Math.cos(latRad));
		return [lng + dLng, lat + dLat];
	}

	function extractWikidataId(battleUri) {
		// Extract Q-id from URI like http://www.wikidata.org/entity/Q12345
		const match = battleUri.match(/\/entity\/(Q\d+)$/);
		return match ? match[1] : null;
	}

	function pushGeoJson(data, coordinates) {
		const wikidataId = extractWikidataId(data.battle.value);
		battlesGeoJson.features.push({
			type: 'Feature',
			properties: {
				title: data.battleLabel.value,
				image: data.image?.value || '',
				startDate: data.startDate ? convertDate(data.startDate.value) : '',
				endDate: data.endDate ? convertDate(data.endDate.value) : '',
				description: data.description?.value || '',
				wikidataId: wikidataId || '',
			},
			geometry: {
				type: 'Point',
				coordinates: coordinates,
			},
		});
	}

	async function fetchDataFromWikipediaViaWikidata(wikidataId) {
		// First, get the Wikipedia article title from Wikidata
		try {
			const wikidataAPI = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(wikidataId)}&props=sitelinks&format=json&origin=*`;
			const wikidataResponse = await fetch(wikidataAPI);
			
			if (!wikidataResponse.ok) throw new Error('Failed to fetch from Wikidata');

			const wikidataData = await wikidataResponse.json();
			const entity = wikidataData.entities[wikidataId];
			
			if (entity && entity.sitelinks && entity.sitelinks.enwiki) {
				const articleTitle = entity.sitelinks.enwiki.title;
				await fetchDataFromWikipedia(articleTitle);
			} else {
				// Fallback to title search if no Wikipedia article found
				await fetchDataFromWikipedia(currentBattle.title.replace(/ /g, '_'));
			}
		} catch (error) {
			console.error('Error fetching from Wikidata:', error);
			// Fallback to title search on error
			await fetchDataFromWikipedia(currentBattle.title.replace(/ /g, '_'));
		}
	}

	async function fetchDataFromWikipedia(articleTitle) {
		const wikipediaAPI = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&titles=${encodeURIComponent(articleTitle)}&exintro=1&inprop=url&origin=*`;

		try {
			const response = await fetch(wikipediaAPI);
			if (!response.ok) throw new Error('Network response was not ok');

			const data = await response.json();
			const article = Object.values(data.query.pages)[0];
			
			// Check if article exists (pageid != -1 means it exists)
			if (article.pageid === -1) {
				return; // Article not found
			}
			
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

	function searchBattlesByTitle(event) {
		dropdownItems = battlesGeoJson.features.filter((battle) => {
			return battle.properties.title.toLowerCase().includes(event.target.value.toLowerCase());
		});
	}

	async function onSelectDropdownItem(event) {
		const battleTitle = event.target.innerText;
		const index = battlesGeoJson.features.findIndex((battle) => battle.properties.title === battleTitle);
		const coordinates = battlesGeoJson.features[index].geometry.coordinates;

		map.easeTo({
			center: coordinates,
			padding: {
				bottom: mobile ? window.innerHeight / 2 : 0,
				top: 0,
				left: 0,
				right: mobile ? 0 : (window.innerWidth - 150) / 2,
			},
			zoom: 10,
		});

		currentBattle = extractBattleData(battlesGeoJson.features[index].properties);
		sidebarLoading = true;
		openSidebar = true;
		if (currentBattle.wikidataId) {
			await fetchDataFromWikipediaViaWikidata(currentBattle.wikidataId);
		} else {
			// Fallback to title search if no Wikidata ID
			await fetchDataFromWikipedia(currentBattle.title.replace(/ /g, '_'));
		}
		sidebarLoading = false;
		dropdownItems = [];
	}

	function handleDropdownItemKeyEvent(event) {
		const currentIndex = parseInt(event.target.parentElement.dataset.index);
		let nextIndex, nextItem;

		switch (event.key) {
			case 'Enter':
				onSelectDropdownItem(event);
				document.querySelector('.close-button').focus();
				break;

			case 'Escape':
				dropdownItems = [];
				break;

			case 'ArrowDown':
				nextIndex = currentIndex + 1;
				nextItem = document.querySelector(`[data-index="${nextIndex}"]`);
				if (nextItem) {
					nextItem.querySelector('button').focus();
				}
				break;

			case 'ArrowUp':
				nextIndex = currentIndex - 1;
				nextItem = document.querySelector(`[data-index="${nextIndex}"]`);
				if (nextItem) {
					nextItem.querySelector('button').focus();
				}
				break;

			default:
				break;
		}
	}
</script>

{#if loading}
	<div class="loader-container">
		<div class="loader" />
	</div>
{/if}
<section id="map"></section>
{#if !loading}
	<div class="search">
		<input class="search__input-field" type="text" placeholder="Search for a battle" on:keyup={searchBattlesByTitle} />
		{#if dropdownItems.length > 0}
			<ul class="search__dropdown-list">
				{#each dropdownItems as { properties }, i}
					<li class="search__dropdown-item" data-index={i}>
						<button class="search__dropdown-button" on:click={onSelectDropdownItem} on:keyup={handleDropdownItemKeyEvent}>
							{properties.title}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<aside id="sidebar" class:open={openSidebar}>
	<header>
		<button class="close-button" on:click={closeSidebar} aria-label="Close sidebar">
			<img class="close-icon" src={closeIcon} alt="Close sidebar" />
		</button>
	</header>
	<article class="sidebar-content">
		{#if sidebarLoading}
			<div class="sidebar-loader-container">
				<div class="sidebar-loader" />
			</div>
		{:else}
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
			{:else}
				<p class="description">No description available</p>
			{/if}
			{#if currentBattle.casualties}
				<p class="casualties">Casualties: {currentBattle.casualties}</p>
			{/if}
		{/if}
	</article>
</aside>

<style>
	@import './+page.css';
</style>
