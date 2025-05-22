<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { Row, Col, Card, CardHeader, CardBody, CardTitle, Alert, Spinner } from "@sveltestrap/sveltestrap";
    import StatisticsCard from "./components/StatisticsCard.svelte";
    import MapboxMap from "$lib/components/MapboxMap.svelte";
    import ApexChart from "$lib/components/ApexChart.svelte";
    import ProblemTreesTable from "./components/ProblemTreesTable.svelte";
    import GanodermaWarning from "./components/GanodermaWarning.svelte";

    import type { PageData as AnalyticsGanoPageDataType } from './$types';
    // Hanya impor ApexOptions. Tipe series akan kita definisikan lokal.
    import type { ApexOptions } from "apexcharts";
    import { page } from '$app/stores';
    import type { UserSessionData, MenuItemType, AppError } from '$lib/types';

    export let data: AnalyticsGanoPageDataType;

    // --- Definisi Tipe Lokal untuk ApexCharts Series (FALLBACK) ---
    // Untuk chart seperti line, bar, area (axis-based)
    interface MyLocalApexSeriesItem {
        name?: string;
        type?: string;
        // Data yang dikirim server untuk performance chart adalah number[]
        data: (number | null)[];
        color?: string;
    }
    type MyLocalApexAxisChartSeries = MyLocalApexSeriesItem[];

    // Untuk chart seperti pie, donut (non-axis) - series adalah number[]
    type MyLocalApexNonAxisChartSeries = number[];
    // -------------------------------------------------------------

    let layoutPageData: { userSession: UserSessionData | undefined; menuItemsForLayout: MenuItemType[] };
    $: layoutPageData = {
        userSession: $page.data.userSession as UserSessionData | undefined,
        menuItemsForLayout: ($page.data.menuItemsForLayout as MenuItemType[]) || []
    };

    let criticalError: AppError | null = null;
    let pageSpecificData: AnalyticsGanoPageDataType | null = null;

    let statistics: AnalyticsGanoPageDataType['statistics'] = [];
    let companyName: string = "Analytics Dashboard";
    let pageTitle: string = "Memuat...";
    let currentTreeDataGeoJSON: AnalyticsGanoPageDataType['treeDataGeoJSON'] = null;
    let currentMapboxAccessToken: string | undefined;
    let currentInitialMapCenter: AnalyticsGanoPageDataType['initialMapCenter'] = { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
    let showGanodermaWarning: boolean = false;
    let sickTreesCountForWarning: number = 0;
    let maxGanodermaLimitForWarning: number = 0;
    let problemTrees: AnalyticsGanoPageDataType['problemTreesList'] = [];
    let serverSideErrorMessage: string | null = null;

    const basePerformanceChartOptions: ApexOptions = { /* ... opsi Anda tetap sama ... */
        chart: { height: 313, type: "line", toolbar: { show: false } },
        stroke: { dashArray: [0, 5], width: [2, 2], curve: 'smooth' },
        fill: { opacity: [1, 0.15], type: ['solid', 'gradient'], gradient: { type: "vertical", inverseColors: false, opacityFrom: 0.5, opacityTo: 0, stops: [0, 90] }},
        markers: { size: 0, strokeWidth: 2, hover: { size: 4 } },
        xaxis: { categories: [], axisTicks: { show: false }, axisBorder: { show: false }, labels: { trim: true, rotate: -45, style: {fontSize: '10px'}}},
        yaxis: { min: 0, axisBorder: { show: false }, labels: { formatter: (val) => val.toFixed(0) } },
        grid: { show: true, strokeDashArray: 3, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } }, padding: { top: 0, right: -2, bottom: 0, left: 10 } },
        legend: { show: true, horizontalAlign: "center", offsetX: 0, offsetY: 5, markers: { size: 8, strokeWidth: 0, offsetX: 0, offsetY: 0 }, itemMargin: { horizontal: 10, vertical: 0 } },
        plotOptions: { bar: { columnWidth: "40%", barHeight: "70%", borderRadius: 3 } },
        colors: ["#7f56da", "#ff6384"],
        tooltip: { shared: true, y: { formatter: (y: number) => (typeof y !== "undefined" ? y.toFixed(0) : y) } },
    };
    const baseCompositionChartOptions: ApexOptions = { /* ... opsi Anda tetap sama ... */
        chart: { height: 320, type: 'donut' },
        plotOptions: { pie: { donut: { size: '65%' } } },
        colors: ['#2ECC40', '#FF4136', '#FFDC00', '#AAAAAA'],
        legend: { show: true, position: 'bottom', horizontalAlign: 'center', offsetY: 5, markers: { size: 8, strokeWidth: 0, offsetX: 0, offsetY: 0 },},
        labels: [],
        dataLabels: { enabled: true, formatter: (val: number, opts: any) => opts.w.globals.seriesTotals[opts.seriesIndex].toFixed(0) },
        tooltip: { y: { formatter: (value: number, { seriesIndex, w }: { seriesIndex: number; dataPointIndex: number; w: any }) => {
            const label = w.globals.labels?.[seriesIndex];
            return `${label}: ${value.toLocaleString('id-ID')} pohon`;
        }}},
        responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
    };

    let finalPerformanceOptions: ApexOptions = { ...basePerformanceChartOptions, series: [], xaxis: {...basePerformanceChartOptions.xaxis, categories: []} };
    let finalCompositionOptions: ApexOptions = { ...baseCompositionChartOptions, series: [], labels: ["Data tidak tersedia"]};

    // Gunakan tipe lokal yang baru didefinisikan
    let an_compositionSeries: MyLocalApexNonAxisChartSeries | undefined = undefined;
    let an_performanceSeries: MyLocalApexAxisChartSeries | undefined = undefined;

    $: {
        criticalError = $page.error as AppError | null;
        if (!criticalError && data) {
            pageSpecificData = data;
            statistics = pageSpecificData.statistics || [];
            companyName = pageSpecificData.companyName || "Analytics Dashboard";
            pageTitle = pageSpecificData.error ? `Peringatan: ${pageSpecificData.companyName}` : `Analytics GanoAI: ${pageSpecificData.companyName || 'Memuat...'}`;
            currentTreeDataGeoJSON = pageSpecificData.treeDataGeoJSON;
            currentMapboxAccessToken = pageSpecificData.mapboxAccessToken;
            currentInitialMapCenter = pageSpecificData.initialMapCenter || { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
            showGanodermaWarning = pageSpecificData.showGanodermaWarning || false;
            sickTreesCountForWarning = pageSpecificData.sickTreesCountForWarning || 0;
            maxGanodermaLimitForWarning = pageSpecificData.maxGanodermaTreeLimitForWarning || 0;
            problemTrees = pageSpecificData.problemTreesList || [];
            serverSideErrorMessage = pageSpecificData.error;

            if (pageSpecificData.treeTrendData?.categories && pageSpecificData.treeTrendData.series) {
                // Data dari server diharapkan Array<{name: string, type: string, data: number[]}>
                // Ini cocok dengan MyLocalApexAxisChartSeries
                an_performanceSeries = pageSpecificData.treeTrendData.series as MyLocalApexAxisChartSeries;
                finalPerformanceOptions = {
                    ...basePerformanceChartOptions,
                    series: an_performanceSeries, // Tipe MyLocalApexAxisChartSeries
                    xaxis: { ...basePerformanceChartOptions.xaxis, categories: pageSpecificData.treeTrendData.categories }
                };
            } else {
                an_performanceSeries = undefined;
                 finalPerformanceOptions = { ...basePerformanceChartOptions, series: [], xaxis: {...basePerformanceChartOptions.xaxis, categories: []} };
            }

            if (pageSpecificData.treeStatusCompositionData?.series && pageSpecificData.treeStatusCompositionData.labels) {
                 const compositionSeriesFromServer = pageSpecificData.treeStatusCompositionData.series; // ini adalah number[]
                 an_compositionSeries = compositionSeriesFromServer as MyLocalApexNonAxisChartSeries;
                 const totalInComposition = compositionSeriesFromServer.reduce((a,b) => a + b, 0);
                finalCompositionOptions = {
                    ...baseCompositionChartOptions,
                    series: totalInComposition > 0 ? an_compositionSeries : [], // Tipe MyLocalApexNonAxisChartSeries (number[])
                    labels: totalInComposition > 0 ? pageSpecificData.treeStatusCompositionData.labels : ["Tidak ada data pohon"]
                };
            } else {
                an_compositionSeries = undefined;
                finalCompositionOptions = { ...baseCompositionChartOptions, series: [], labels: ["Data tidak tersedia"]};
            }

        } else if (criticalError) {
            pageTitle = "Error Memuat Data";
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
    {:else if serverSideErrorMessage && !criticalError }
        <Alert color="warning" class="mt-3">{serverSideErrorMessage}</Alert>
    {/if}

    {#if !criticalError}
        {#if showGanodermaWarning && !serverSideErrorMessage }
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
                                    <h4 class="card-title text-white mb-0 text-center" style="font-size: 1.1rem;">{item.title}</h4>
                                </CardBody>
                            </Card>
                        {:else}
                            <StatisticsCard {item} class="w-100 d-flex flex-column h-100 shadow-sm"/>
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
                             <div class="text-center py-5"><Spinner color="primary" /><p class="mt-2 text-muted">Memuat data peta...</p></div>
                        {:else}
                             <p class="text-center text-muted py-5">Data peta tidak dapat dimuat atau tidak ada pohon terdata.</p>
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
                        {#if an_compositionSeries && an_compositionSeries.length > 0 && an_compositionSeries.reduce((a,b) => a + b, 0) > 0}
                            <div style="min-height: 300px; width: 100%;">
                                 <ApexChart id="gano-composition-chart" options={finalCompositionOptions} />
                            </div>
                        {:else if !serverSideErrorMessage}
                            <div class="text-center py-5"><Spinner color="primary" /><p class="mt-2 text-muted">Memuat komposisi...</p></div>
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
                    <CardHeader class="bg-light py-2 border-bottom-0">
                        <CardTitle class="mb-0 fs-1rem fw-medium">Dinamika Kesehatan Kebun (12 Bulan Terakhir)</CardTitle>
                    </CardHeader>
                    <CardBody class="pt-2">
                        {#if an_performanceSeries && an_performanceSeries.length > 0 && an_performanceSeries[0]?.data?.length > 0}
                             <div style="min-height: 313px;">
                                <ApexChart id="gano-trend-chart" options={finalPerformanceOptions} />
                             </div>
                        {:else if !serverSideErrorMessage}
                            <div class="text-center py-5"><Spinner color="primary" /><p class="mt-2 text-muted">Memuat data tren...</p></div>
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