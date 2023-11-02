<div id="map"></div>
<script>
	import mapboxgl from "mapbox-gl";
	import "../../node_modules/mapbox-gl/dist/mapbox-gl.css"
	import { onMount } from "svelte";

	onMount(() => {
			const mapboxkey = 'pk.eyJ1IjoiYWxleDIyNDAiLCJhIjoiY2xvMDNjYjFnMTRycDJubzZlc3NnbG56byJ9.fVFXHiJm2WS5M33-4gH20g';
			mapboxgl.accessToken = mapboxkey;
		let map = new mapboxgl.Map({
			container: "map",
			style: "mapbox://styles/mapbox/streets-v11",
			center: [-74.5, 40],
			zoom: 9,
		});
	});
</script>

<style>
	#map {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;
	}
</style>