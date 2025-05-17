<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { Row, Col, Card, CardHeader, CardBody, CardTitle, Alert } from "@sveltestrap/sveltestrap";
    import StatisticsCard from "./components/StatisticsCard.svelte"; // Pastikan path ini benar
    import MapboxMap from "$lib/components/MapboxMap.svelte";
    import ApexChart from "$lib/components/ApexChart.svelte";
    import ProblemTreesTable from "./components/ProblemTreesTable.svelte"; // Pastikan path ini benar

    import type { PageData } from './$types';
    import type { ApexOptions } from "apexcharts";

    export let data: PageData; // 'data' ini datang dari SvelteKit

    $: statistics = data?.statistics || [];
    $: companyName = data?.companyName || "Analytics Dashboard";
    $: pageTitle = data?.error ? "Error Memuat Data" : `Analytics: ${companyName}`;
    $: currentTreeDataGeoJSON = data?.treeDataGeoJSON;
    $: currentMapboxAccessToken = data?.mapboxAccessToken;
    $: currentInitialMapCenter = data?.initialMapCenter || { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
    
    const basePerformanceChartOptions: ApexOptions = { /* ... opsi Anda ... */
        chart: { height: 313, type: "line", toolbar: { show: false } },
        stroke: { dashArray: [0, 5], width: [2, 2], curve: 'smooth' },
        fill: { opacity: [1, 0.15], type: ['solid', 'gradient'], gradient: { type: "vertical", inverseColors: false, opacityFrom: 0.5, opacityTo: 0, stops: [0, 90] }},
        markers: { size: 0, strokeWidth: 2, hover: { size: 4 } },
        xaxis: { categories: [], axisTicks: { show: false }, axisBorder: { show: false } },
        yaxis: { min: 0, axisBorder: { show: false }, labels: { formatter: (val) => val.toFixed(0) } },
        grid: { show: true, strokeDashArray: 3, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } }, padding: { top: 0, right: -2, bottom: 0, left: 10 } },
        legend: { 
            show: true, horizontalAlign: "center", offsetX: 0, offsetY: 5, 
            markers: { size: 8, strokeWidth: 0, offsetX: 0, offsetY: 0 }, 
            itemMargin: { horizontal: 10, vertical: 0 } 
        },
        plotOptions: { bar: { columnWidth: "40%", barHeight: "70%", borderRadius: 3 } },
        colors: ["#7f56da", "#ff6384"],
        tooltip: { shared: true, y: { formatter: (y: number) => (typeof y !== "undefined" ? y.toFixed(0) : y) } },
    };
    const baseCompositionChartOptions: ApexOptions = { /* ... opsi Anda ... */
        chart: { height: 320, type: 'donut' },
        plotOptions: { pie: { donut: { size: '65%' } } },
        colors: ['#2ECC40', '#FF4136', '#FFDC00', '#AAAAAA'],
        legend: { 
            show: true, position: 'bottom', horizontalAlign: 'center', offsetY: 5,
             markers: { size: 8, strokeWidth: 0, offsetX: 0, offsetY: 0 },
        },
        labels: [],
        responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
    };

    $: finalPerformanceOptions = data?.treeTrendData && data.treeTrendData.categories && data.treeTrendData.series ? {
        ...basePerformanceChartOptions,
        series: data.treeTrendData.series,
        xaxis: { ...basePerformanceChartOptions.xaxis, categories: data.treeTrendData.categories }
    } : { ...basePerformanceChartOptions, series: [], xaxis: {...basePerformanceChartOptions.xaxis, categories: []} };

    $: finalCompositionOptions = data?.treeStatusCompositionData && data.treeStatusCompositionData.series && data.treeStatusCompositionData.labels ? {
        ...baseCompositionChartOptions,
        series: data.treeStatusCompositionData.series,
        labels: data.treeStatusCompositionData.labels
    } : { ...baseCompositionChartOptions, series: [], labels: []};

    $: problemTrees = data?.problemTreesList || [];
</script>

<DefaultLayout {data}>
    <PageBreadcrumb title={pageTitle} subTitle="Dashboards" />

    {#if data?.error}
        <Alert color="danger" class="mt-2">{data.error}</Alert>
    {/if}

    <Row class="mt-2">
        {#if statistics.length > 0}
            {#each statistics as item, i (item.title)}
                <Col md="6" xl="3" class="mb-3 d-flex"> 
                    {#if i === 0 && item.statistic === ''}
                        <Card class="bg-primary text-white w-100">
                            <CardBody class="d-flex align-items-center justify-content-center">
                                <h4 class="card-title text-white mb-0 text-center" style="font-size: 1.1rem;">{item.title}</h4>
                            </CardBody>
                        </Card>
                    {:else}
                        <StatisticsCard {item} class="w-100 d-flex flex-column h-100"/>
                    {/if}
                </Col>
            {/each}
        {:else if !data?.error}
            <Col> <p>Memuat data statistik...</p> </Col>
        {/if}
    </Row>

    <Row class="mt-3">
        <Col xl="8" class="mb-3 mb-xl-0">
            <Card class="h-100">
                <CardHeader>
                    <CardTitle class="mb-0">Peta Sebaran Kesehatan Pohon</CardTitle>
                </CardHeader>
                <CardBody>
                    {#if currentMapboxAccessToken && currentTreeDataGeoJSON}
                        <MapboxMap 
                            accessToken={currentMapboxAccessToken} 
                            treeDataGeoJSON={currentTreeDataGeoJSON}
                            initialViewState={currentInitialMapCenter}
                        />
                    {:else if !currentMapboxAccessToken}
                        <Alert color="warning">Token Mapbox tidak tersedia atau data peta belum siap.</Alert>
                    {:else}
                        <p class="text-center text-muted py-5">Memuat data peta...</p>
                    {/if}
                </CardBody>
            </Card>
        </Col>
        <Col xl="4">
            <Card class="h-100">
                <CardHeader>
                    <CardTitle class="mb-0">Status Kesehatan Pohon</CardTitle>
                </CardHeader>
                <CardBody class="d-flex justify-content-center align-items-center">
                    {#if data?.treeStatusCompositionData && data.treeStatusCompositionData.series && data.treeStatusCompositionData.series.reduce((a,b) => a+b, 0) > 0}
                        <div style="min-height: 300px; width: 100%;">
                             <ApexChart id="composition-chart" options={finalCompositionOptions} />
                        </div>
                    {:else if !data?.error}
                         <p class="text-center text-muted py-5">Memuat data komposisi...</p>
                    {:else}
                         <p class="text-center text-muted py-5">Data komposisi tidak tersedia.</p>
                    {/if}
                </CardBody>
            </Card>
        </Col>
    </Row> 
    
    <Row class="mt-3">
        <Col lg="12" class="mb-3">
            <Card>
                <CardHeader>
                    <CardTitle class="mb-0">Dinamika Kesehatan Kebun (12 Bulan Terakhir)</CardTitle>
                </CardHeader>
                <CardBody>
                    {#if data?.treeTrendData && data.treeTrendData.categories && data.treeTrendData.categories.length > 0}
                         <div style="min-height: 313px;">
                            <ApexChart id="trend-chart" options={finalPerformanceOptions} />
                         </div>
                    {:else if !data?.error}
                        <p class="text-center text-muted py-5">Memuat data tren...</p>
                    {:else}
                        <p class="text-center text-muted py-5">Data tren tidak tersedia.</p>
                    {/if}
                </CardBody>
            </Card>
        </Col>
    </Row>
    
    <Row class="mt-3">
        <Col>
           <ProblemTreesTable trees={problemTrees} />
        </Col>
    </Row>
</DefaultLayout>