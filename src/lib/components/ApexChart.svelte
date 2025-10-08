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
		const ApexCharts = (await import('apexcharts')).default;

		// Fungsi untuk menginisialisasi chart
		const initChart = () => {
			// Hancurkan chart lama jika ada untuk mencegah memory leak
			if (chart) {
				chart.destroy();
				chart = null;
			}
			
			// Buat instance chart baru
			chart = new ApexCharts(chartElement, options);
			chart.render();
		};

		// Fungsi untuk memeriksa apakah kontainer sudah siap
		const checkAndRender = () => {
			// Cek apakah lebar kontainer sudah lebih dari 0
			if (chartElement && chartElement.clientWidth > 0) {
				initChart();
			} else {
				// Jika belum, tunggu sejenak dan coba lagi.
				// Ini memberi waktu pada browser untuk menyelesaikan kalkulasi layout.
				setTimeout(checkAndRender, 50); 
			}
		};
		
		// Mulai proses pengecekan
		checkAndRender();
	});

	$: if (chart && options && chartElement.clientWidth > 0) {
		chart.updateOptions(options);
	}
</script>

<div bind:this={chartElement} {id} class={`apex-charts ${customClass}`} {dir} />