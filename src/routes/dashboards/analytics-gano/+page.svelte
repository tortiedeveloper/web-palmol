<script lang="ts">
	import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import {
		Row,
		Col,
		Card,
		CardHeader,
		CardBody,
		CardTitle,
		Alert,
		Spinner,
		ButtonGroup,
		Button
	} from '@sveltestrap/sveltestrap';
	import StatisticsCard from './components/StatisticsCard.svelte';
	import MapboxMap from '$lib/components/MapboxMap.svelte';
	import ApexChart from '$lib/components/ApexChart.svelte';
	import ProblemTreesTable from './components/ProblemTreesTable.svelte';
	import GanodermaWarning from './components/GanodermaWarning.svelte';

	import type { PageData as AnalyticsGanoPageDataType } from './$types';
	import type { ApexOptions } from 'apexcharts';
	import { page } from '$app/stores';
	import type { UserSessionData, MenuItemType, AppError } from '$lib/types';

	// BARU: Impor 'goto' untuk navigasi sisi klien
	import { goto } from '$app/navigation';

	export let data: AnalyticsGanoPageDataType;

	interface MyLocalApexSeriesItem {
		name?: string;
		type?: string;
		data: (number | null)[];
		color?: string;
	}
	type MyLocalApexAxisChartSeries = MyLocalApexSeriesItem[];
	type MyLocalApexNonAxisChartSeries = number[];

	let layoutPageData: { userSession: UserSessionData | undefined; menuItemsForLayout: MenuItemType[] };
	$: layoutPageData = {
		userSession: $page.data.userSession as UserSessionData | undefined,
		menuItemsForLayout: ($page.data.menuItemsForLayout as MenuItemType[]) || []
	};

	$: selectedTimeframe = data.timeframe || 'monthly';

	// BARU: Fungsi untuk mengubah timeframe tanpa refresh halaman
	function changeTimeframe(timeframe: 'daily' | 'monthly') {
		// Cek agar tidak navigasi jika timeframe sudah sama
		if (selectedTimeframe === timeframe) return;

		goto(`?timeframe=${timeframe}`, {
			invalidateAll: true, // Memaksa SvelteKit memuat ulang data dari server
			noScroll: true // Mencegah halaman scroll ke atas
		});
	}

	// Sisa dari blok <script> Anda tidak perlu diubah...
	let criticalError: AppError | null = null;
	let pageSpecificData: AnalyticsGanoPageDataType | null = null;

	let statistics: AnalyticsGanoPageDataType['statistics'] = [];
	let companyName: string = 'Analytics Dashboard';
	let pageTitle: string = 'Memuat...';
	let currentTreeDataGeoJSON: AnalyticsGanoPageDataType['treeDataGeoJSON'] = null;
	let currentMapboxAccessToken: string | undefined;
	let currentInitialMapCenter: AnalyticsGanoPageDataType['initialMapCenter'] = {
		latitude: -2.5489,
		longitude: 118.0149,
		zoom: 5
	};
	let showGanodermaWarning: boolean = false;
	let sickTreesCountForWarning: number = 0;
	let maxGanodermaLimitForWarning: number = 0;
	let problemTrees: AnalyticsGanoPageDataType['problemTreesList'] = [];
	let serverSideErrorMessage: string | null = null;

	const basePerformanceChartOptions: ApexOptions = {
		chart: { height: 313, type: 'line', toolbar: { show: false } },
		stroke: { width: [2, 2, 2], curve: 'straight', lineCap: 'butt' }, // Tambahkan lineCap: 'butt'
		markers: { size: 4 },
		xaxis: {
			categories: [],
			axisTicks: { show: false },
			axisBorder: { show: false },
			labels: { trim: true, rotate: -45, style: { fontSize: '10px' } }
		},
		yaxis: {
			min: 0,
			axisBorder: { show: false },
			labels: { formatter: (val) => val.toFixed(0) }
		},
		grid: {
			show: true,
			strokeDashArray: 3,
			xaxis: { lines: { show: false } },
			yaxis: { lines: { show: true } },
			padding: { top: 0, right: -2, bottom: 0, left: 10 }
		},
		legend: {
			show: true,
			horizontalAlign: 'center',
			offsetX: 0,
			offsetY: 5,
			markers: { size: 8, strokeWidth: 0, offsetX: 0, offsetY: 0 },
			itemMargin: { horizontal: 10, vertical: 0 }
		},
		colors: ['#FF4136', '#2ECC40', '#FFDC00'], // Merah (Sakit), Hijau (Pulih), Kuning (Dirawat)
		tooltip: {
			shared: true,
			intersect: false,
			y: { formatter: (y: number) => (typeof y !== 'undefined' ? y.toFixed(0) + ' pohon' : y) }
		}
	};
	const baseCompositionChartOptions: ApexOptions = {
		chart: { height: 320, type: 'donut' },
		plotOptions: { pie: { donut: { size: '65%' } } },
		colors: ['#2ECC40', '#FF4136', '#FFDC00', '#AAAAAA'],
		legend: {
			show: true,
			position: 'bottom',
			horizontalAlign: 'center',
			offsetY: 5,
			markers: { size: 8, strokeWidth: 0, offsetX: 0, offsetY: 0 }
		},
		labels: [],
		dataLabels: {
			enabled: true,
			formatter: (val: number, opts: any) => opts.w.globals.seriesTotals[opts.seriesIndex].toFixed(0)
		},
		tooltip: {
			y: {
				formatter: (
					value: number,
					{ seriesIndex, w }: { seriesIndex: number; dataPointIndex: number; w: any }
				) => {
					const label = w.globals.labels?.[seriesIndex];
					return `${label}: ${value.toLocaleString('id-ID')} pohon`;
				}
			}
		},
		responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
	};

	let finalPerformanceOptions: ApexOptions = {
		...basePerformanceChartOptions,
		series: [],
		xaxis: { ...basePerformanceChartOptions.xaxis, categories: [] }
	};
	let finalCompositionOptions: ApexOptions = {
		...baseCompositionChartOptions,
		series: [],
		labels: ['Data tidak tersedia']
	};

	let an_compositionSeries: MyLocalApexNonAxisChartSeries | undefined = undefined;
	let an_performanceSeries: MyLocalApexAxisChartSeries | undefined = undefined;

	$: {
		criticalError = $page.error as AppError | null;
		if (!criticalError && data) {
			pageSpecificData = data;
			statistics = pageSpecificData.statistics || [];
			companyName = pageSpecificData.companyName || 'Analytics Dashboard';
			pageTitle = pageSpecificData.error
				? `Peringatan: ${pageSpecificData.companyName}`
				: `Analytics GanoAI: ${pageSpecificData.companyName || 'Memuat...'}`;
			currentTreeDataGeoJSON = pageSpecificData.treeDataGeoJSON;
			currentMapboxAccessToken = pageSpecificData.mapboxAccessToken;
			currentInitialMapCenter = pageSpecificData.initialMapCenter || {
				latitude: -2.5489,
				longitude: 118.0149,
				zoom: 5
			};
			showGanodermaWarning = pageSpecificData.showGanodermaWarning || false;
			sickTreesCountForWarning = pageSpecificData.sickTreesCountForWarning || 0;
			maxGanodermaLimitForWarning = pageSpecificData.maxGanodermaTreeLimitForWarning || 0;
			problemTrees = pageSpecificData.problemTreesList || [];
			serverSideErrorMessage = pageSpecificData.error;

			if (pageSpecificData.treeTrendData?.categories && pageSpecificData.treeTrendData.series) {
				an_performanceSeries =
					pageSpecificData.treeTrendData.series as MyLocalApexAxisChartSeries;
				finalPerformanceOptions = {
					...basePerformanceChartOptions,
					series: an_performanceSeries,
					xaxis: {
						...basePerformanceChartOptions.xaxis,
						categories: pageSpecificData.treeTrendData.categories
					}
				};
			} else {
				an_performanceSeries = undefined;
				finalPerformanceOptions = {
					...basePerformanceChartOptions,
					series: [],
					xaxis: { ...basePerformanceChartOptions.xaxis, categories: [] }
				};
			}

			if (
				pageSpecificData.treeStatusCompositionData?.series &&
				pageSpecificData.treeStatusCompositionData.labels
			) {
				const compositionSeriesFromServer = pageSpecificData.treeStatusCompositionData.series;
				an_compositionSeries = compositionSeriesFromServer as MyLocalApexNonAxisChartSeries;
				const totalInComposition = compositionSeriesFromServer.reduce((a, b) => a + b, 0);
				finalCompositionOptions = {
					...baseCompositionChartOptions,
					series: totalInComposition > 0 ? an_compositionSeries : [],
					labels:
						totalInComposition > 0
							? pageSpecificData.treeStatusCompositionData.labels
							: ['Tidak ada data pohon']
				};
			} else {
				an_compositionSeries = undefined;
				finalCompositionOptions = {
					...baseCompositionChartOptions,
					series: [],
					labels: ['Data tidak tersedia']
				};
			}
		} else if (criticalError) {
			pageTitle = 'Error Memuat Data';
			statistics = [];
			currentTreeDataGeoJSON = null;
			an_performanceSeries = undefined;
			an_compositionSeries = undefined;
			problemTrees = [];
		}
	}
</script>

<DefaultLayout data={layoutPageData}>
	<PageBreadcrumb title={pageTitle} subTitle="Dashboards GanoAI" />

	{#if criticalError}
		<Alert color="danger" class="mt-3">
			<h4 class="alert-heading">Terjadi Kesalahan Server</h4>
			<p>{criticalError.message || 'Tidak dapat memuat data dashboard GanoAI.'}</p>
		</Alert>
	{:else if serverSideErrorMessage && !criticalError}
		<Alert color="warning" class="mt-3">{serverSideErrorMessage}</Alert>
	{/if}

	{#if !criticalError}
		{#if showGanodermaWarning && !serverSideErrorMessage}
			<GanodermaWarning
				sickTrees={sickTreesCountForWarning}
				limit={maxGanodermaLimitForWarning}
				companyName={companyName}
			/>
		{/if}

		<Row class="mt-2">
			{#if statistics.length > 0}
				{#each statistics as item, i (item.title)}
					<Col md="6" xl="3" class="mb-3 d-flex">
						{#if i === 0 && item.statistic === ''}
							<Card class="bg-primary text-white w-100 shadow-sm">
								<CardBody class="d-flex align-items-center justify-content-center">
									<h4 class="card-title text-white mb-0 text-center" style="font-size: 1.1rem;">
										{item.title}
									</h4>
								</CardBody>
							</Card>
						{:else}
							<StatisticsCard {item} class="w-100 d-flex flex-column h-100 shadow-sm" />
						{/if}
					</Col>
				{/each}
			{:else if !serverSideErrorMessage}
				<Col class="text-center py-5">
					<Spinner size="lg" color="primary" />
					<p class="mt-2 text-muted">Memuat data statistik...</p>
				</Col>
			{/if}
		</Row>

		<Row class="mt-1">
			<Col xl="8" class="mb-3 mb-xl-0 d-flex">
				<Card class="h-100 shadow-sm w-100">
					<CardHeader class="bg-light py-2 border-bottom-0">
						<CardTitle class="mb-0 fs-1rem fw-medium">Peta Sebaran Kesehatan Pohon</CardTitle>
					</CardHeader>
					<CardBody class="pt-2">
						{#if currentMapboxAccessToken && currentTreeDataGeoJSON && currentTreeDataGeoJSON.features.length > 0}
							<MapboxMap
								accessToken={currentMapboxAccessToken}
								treeDataGeoJSON={currentTreeDataGeoJSON}
								initialViewState={currentInitialMapCenter}
							/>
						{:else if !currentMapboxAccessToken}
							<Alert color="warning" class="my-3">Token Mapbox tidak tersedia.</Alert>
						{:else if !serverSideErrorMessage}
							<div class="text-center py-5">
								<Spinner color="primary" /><p class="mt-2 text-muted">Memuat data peta...</p>
							</div>
						{:else}
							<p class="text-center text-muted py-5">
								Data peta tidak dapat dimuat atau tidak ada pohon terdata.
							</p>
						{/if}
					</CardBody>
				</Card>
			</Col>
			<Col xl="4" class="d-flex">
				<Card class="h-100 shadow-sm w-100">
					<CardHeader class="bg-light py-2 border-bottom-0">
						<CardTitle class="mb-0 fs-1rem fw-medium">Status Kesehatan Pohon</CardTitle>
					</CardHeader>
					<CardBody class="d-flex justify-content-center align-items-center pt-2">
						{#if an_compositionSeries && an_compositionSeries.length > 0 && an_compositionSeries.reduce((a, b) => a + b, 0) > 0}
							<div style="min-height: 300px; width: 100%;">
								<ApexChart id="gano-composition-chart" options={finalCompositionOptions} />
							</div>
						{:else if !serverSideErrorMessage}
							<div class="text-center py-5">
								<Spinner color="primary" /><p class="mt-2 text-muted">Memuat komposisi...</p>
							</div>
						{:else}
							<p class="text-center text-muted py-5">Data komposisi tidak tersedia.</p>
						{/if}
					</CardBody>
				</Card>
			</Col>
		</Row>

		<Row class="mt-3">
			<Col lg="12" class="mb-3 d-flex">
				<Card class="shadow-sm w-100">
					<CardHeader
						class="bg-light py-2 border-bottom-0 d-flex flex-wrap justify-content-between align-items-center"
					>
						<CardTitle class="mb-0 fs-1rem fw-medium me-3">Dinamika Kesehatan Kebun</CardTitle>
						
						<ButtonGroup size="sm">
							<Button
								on:click={() => changeTimeframe('monthly')}
								outline
								color="primary"
								active={selectedTimeframe === 'monthly'}
							>
								Bulanan
							</Button>
							<Button
								on:click={() => changeTimeframe('daily')}
								outline
								color="primary"
								active={selectedTimeframe === 'daily'}
							>
								Harian
							</Button>
						</ButtonGroup>
					</CardHeader>
					
					<CardBody class="pt-2">
						{#if an_performanceSeries && an_performanceSeries.length > 0 && an_performanceSeries[0]?.data?.length > 0}
							<div style="min-height: 313px;">
								<ApexChart id="gano-trend-chart" options={finalPerformanceOptions} />
							</div>
						{:else if !serverSideErrorMessage}
							<div class="text-center py-5">
								<Spinner color="primary" /><p class="mt-2 text-muted">Memuat data tren...</p>
							</div>
						{:else}
							<p class="text-center text-muted py-5">Data tren tidak tersedia.</p>
						{/if}
					</CardBody>
				</Card>
			</Col>
		</Row>

		<Row class="mt-1 mb-3">
			<Col>
				<ProblemTreesTable trees={problemTrees} />
			</Col>
		</Row>
	{/if}
</DefaultLayout>