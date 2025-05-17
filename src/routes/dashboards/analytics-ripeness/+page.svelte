<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    // PERBAIKAN: Tambahkan Table ke impor Sveltestrap
    import { Row, Col, Card, CardHeader, CardBody, CardTitle, Alert, Table, Button } from "@sveltestrap/sveltestrap";
    import StatisticsCard from "./components/StatisticsCard.svelte"; 
    import MapboxMapRipeness from "$lib/components/MapboxMapRipeness.svelte"; // Impor komponen baru
    import ApexChart from "$lib/components/ApexChart.svelte";
    // Hapus ProblemTreesTable jika Anda membuat tabel langsung di sini
    // import ProblemTreesTable from "$lib/components/widgets/ProblemTreesTable.svelte"; 

    import type { PageData } from './$types';
    import type { ApexOptions } from "apexcharts";
    import type { HarvestReadyTree } from '$lib/types'; // Impor tipe HarvestReadyTree

    export let data: PageData;

    $: statistics = data?.statistics || [];
    $: companyName = data?.companyName || "Analytics Ripeness";
    $: pageTitle = data?.error ? "Error Memuat Data" : `Analytics Ripeness: ${companyName}`;
    $: currentTreeDataGeoJSON = data?.treeDataGeoJSON; // Sekarang bisa null
    $: currentMapboxAccessToken = data?.mapboxAccessToken;
    $: currentInitialMapCenter = data?.initialMapCenter || { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
    
    // ... (baseTrendChartOptions dan baseFruitCompositionChartOptions tetap sama) ...
    const baseTrendChartOptions: ApexOptions = {
        chart: { height: 313, type: "line", toolbar: { show: false } },
        stroke: { curve: 'smooth', width: 2 },
        markers: { size: 4 },
        xaxis: { categories: [], axisTicks: { show: false }, axisBorder: { show: false } },
        yaxis: { min: 0, labels: { formatter: (val) => val.toFixed(0) + " buah" } },
        grid: { show: true, strokeDashArray: 3, yaxis: { lines: { show: true } } },
        legend: { show: true, horizontalAlign: "center", offsetY: 5, markers: { size: 8, strokeWidth: 0} },
        colors: ["#2ECC71"],
        tooltip: { y: { formatter: (y: number) => (typeof y !== "undefined" ? y.toFixed(0) + " buah" : y) } },
    };

    const baseFruitCompositionChartOptions: ApexOptions = {
        chart: { height: 320, type: 'donut' },
        plotOptions: { pie: { donut: { size: '65%' } } },
        colors: ['#2ECC40', '#F1C40F', '#E74C3C', '#AAAAAA'], // Matang, BelumMatang, TerlaluMatang, Lainnya
        legend: { 
            show: true, position: 'bottom', horizontalAlign: 'center', offsetY: 5, 
            markers: {size: 8, strokeWidth: 0} 
        },
        labels: [],
        dataLabels: { enabled: true, formatter: (val: number, opts: any) => opts.w.globals.seriesTotals[opts.seriesIndex].toFixed(0) + ' buah' },
        tooltip: { y: { formatter: (value: number) => value + " buah" } },
    };


    $: finalTrendOptions = data?.fruitTrendData && data.fruitTrendData.categories && data.fruitTrendData.series ? {
        ...baseTrendChartOptions,
        series: data.fruitTrendData.series,
        xaxis: { ...baseTrendChartOptions.xaxis, categories: data.fruitTrendData.categories }
    } : { ...baseTrendChartOptions, series: [], xaxis: {...baseTrendChartOptions.xaxis, categories: []} };

    $: finalCompositionOptions = data?.fruitCompositionData && data.fruitCompositionData.series && data.fruitCompositionData.labels ? {
        ...baseFruitCompositionChartOptions,
        series: data.fruitCompositionData.series,
        labels: data.fruitCompositionData.labels
    } : { ...baseFruitCompositionChartOptions, series: [], labels: []};

    $: harvestReadyTrees = data?.harvestReadyTreesList || [];

</script>

<DefaultLayout {data}>
    <PageBreadcrumb title={pageTitle} subTitle="Dashboards Ripeness" />

    {#if data?.error}
        <Alert color="danger" class="mt-2">{data.error}</Alert>
    {/if}

    <Row class="mt-2">
        {#each statistics as item, i (item.title)}
            <Col md="6" xl="3" class="mb-3 d-flex"> 
                {#if i === 0 && item.statistic === ''}
                    <Card class="bg-success text-white w-100">
                        <CardBody class="d-flex align-items-center justify-content-center">
                            <h4 class="card-title text-white mb-0 text-center" style="font-size: 1.1rem;">{item.title}</h4>
                        </CardBody>
                    </Card>
                {:else}
                    <StatisticsCard {item} class="w-100 d-flex flex-column h-100"/>
                {/if}
            </Col>
        {/each}
    </Row>

    <Row class="mt-3">
        <Col xl="8" class="mb-3 mb-xl-0">
            <Card class="h-100">
                <CardHeader><CardTitle class="mb-0">Peta Potensi Panen Pohon</CardTitle></CardHeader>
                <CardBody>
                    {#if currentMapboxAccessToken && currentTreeDataGeoJSON}
                        <MapboxMapRipeness  
                            accessToken={currentMapboxAccessToken} 
                            treeDataGeoJSON={currentTreeDataGeoJSON} 
                            initialViewState={currentInitialMapCenter}
                        />
                    {:else if !currentMapboxAccessToken}
                        <Alert color="warning">Token Mapbox tidak tersedia.</Alert>
                    {:else}
                        <p class="text-center text-muted py-5">Memuat data peta atau data pohon tidak tersedia...</p>
                    {/if}
                </CardBody>
            </Card>
        </Col>
        <Col xl="4">
            <Card class="h-100">
                <CardHeader><CardTitle class="mb-0">Komposisi Kematangan Buah</CardTitle></CardHeader>
                <CardBody class="d-flex justify-content-center align-items-center">
                    {#if data?.fruitCompositionData && data.fruitCompositionData.series?.reduce((a,b) => a+b, 0) > 0}
                        <div style="min-height: 300px; width: 100%;">
                             <ApexChart id="fruit-composition-chart" options={finalCompositionOptions} />
                        </div>
                    {:else}
                         <p class="text-center text-muted py-5">{data?.error ? 'Data komposisi tidak tersedia.' : 'Memuat data komposisi...'}</p>
                    {/if}
                </CardBody>
            </Card>
        </Col>
    </Row> 
    
    <Row class="mt-3">
        <Col lg="12" class="mb-3">
            <Card>
                <CardHeader><CardTitle class="mb-0">Tren Jumlah Buah Matang (12 Bulan Terakhir)</CardTitle></CardHeader>
                <CardBody>
                    {#if data?.fruitTrendData && data.fruitTrendData.categories?.length > 0}
                         <div style="min-height: 313px;">
                            <ApexChart id="fruit-trend-chart" options={finalTrendOptions} />
                         </div>
                    {:else}
                        <p class="text-center text-muted py-5">{data?.error ? 'Data tren tidak tersedia.' : 'Memuat data tren...'}</p>
                    {/if}
                </CardBody>
            </Card>
        </Col>
    </Row>
    
    <Row class="mt-3">
        <Col>
            <Card>
                <CardHeader><CardTitle class="mb-0">Pohon Siap Panen Teratas</CardTitle></CardHeader>
                <CardBody>
                    {#if harvestReadyTrees.length > 0}
                        <div class="table-responsive">
                            <Table hover responsive class="table-sm align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Nama Pohon</th>
                                        <th class="text-center">Matang</th>
                                        <th class="text-center">Belum Matang</th>
                                        <th class="text-center">Terlalu Matang</th>
                                        <th>Update Terakhir</th>
                                        <th>Pelapor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each harvestReadyTrees as tree (tree.id)}
                                        <tr>
                                            <td>
                                                {tree.name}
                                                
                                            </td>
                                            <td class="text-center fw-bold text-success">{tree.fruitCounts.matang}</td>
                                            <td class="text-center">{tree.fruitCounts.belumMatang}</td>
                                            <td class="text-center text-danger">{tree.fruitCounts.terlaluMatang}</td>
                                            <td>{tree.updatedDate}</td>
                                            <td>{tree.reportedBy}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </Table>
                        </div>
                    {:else}
                        <p class="text-muted text-center py-3">Tidak ada pohon yang siap panen saat ini.</p>
                    {/if}
                </CardBody>
            </Card>
        </Col>
    </Row>
</DefaultLayout>