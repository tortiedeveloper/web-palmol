<script lang="ts">
	import { onMount } from 'svelte';
	import type { ApexOptions } from 'apexcharts';

	// JANGAN impor ApexCharts di sini
	
	export let id: string;
	export let customClass: string = '';
	export let options: ApexOptions;
	export let dir = '';

	// Variabel untuk menyimpan instance chart, gunakan 'any' karena akan diisi secara dinamis
	let chart: any = null;
	let chartElement: HTMLDivElement;

	// onMount HANYA berjalan di sisi browser, setelah server render selesai
	onMount(async () => {
		// Impor library secara dinamis HANYA di browser
		const ApexCharts = (await import('apexcharts')).default;

		// Buat instance chart sekarang karena kita sudah pasti di browser
		chart = new ApexCharts(chartElement, options);
		chart.render();
	});

	// Blok reaktif ini tetap ada dan akan berfungsi dengan baik.
	// Ia tidak akan berjalan di server karena 'chart' awalnya adalah null.
	// Ia baru akan aktif di sisi klien setelah onMount selesai.
	$: if (chart && options) {
		chart.updateOptions(options);
	}
</script>

<div bind:this={chartElement} {id} class={`apex-charts ${customClass}`} {dir} />