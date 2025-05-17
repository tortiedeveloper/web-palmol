<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { Row, Col, Card, CardHeader, CardBody, CardTitle, Alert, Table, Button, FormGroup, Label, Input, Spinner } from "@sveltestrap/sveltestrap";
    import StatisticsCard from "./components/StatisticsCard.svelte"; 
    import ApexChart from "$lib/components/ApexChart.svelte";
    import FlatPicker from '$lib/components/FlatPicker.svelte';
    import type { PageData } from './$types';
    import type { ApexOptions } from "apexcharts";
    import type { StatisticCardType, AppError, TopPerformer } from '$lib/types'; 
    import Icon from '@iconify/svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    interface FilterChoiceClient { id: string; name: string; }

    export let data: PageData;

    let uiSelectedPksId: string | undefined = undefined;
    let uiSelectedStartDate: string | undefined = undefined;
    let uiSelectedEndDate: string | undefined = undefined;
    let initialLoadComplete = false;

    let companyName: string | undefined;
    let statistics: StatisticCardType[] = [];
    let trendChartData: PageData['trendChartData'];
    let pksContributionData: PageData['pksContributionChartData'];
    let topTeams: TopPerformer[] = [];
    let topReporters: TopPerformer[] = [];
    let pksListForFilter: FilterChoiceClient[] = [];
    let serverMessage: string | null | undefined;
    let activeIsCurrentlyFiltered: boolean = false;
    let clientError: AppError | null = null;

    onMount(() => {
        if (data) {
            companyName = data.companyName || "Analitik Palmol";
            statistics = data.statistics || [];
            trendChartData = data.trendChartData;
            pksContributionData = data.pksContributionChartData;
            topTeams = data.topTeams || [];
            topReporters = data.topReporters || [];
            pksListForFilter = data.pksListForFilter || [];
            serverMessage = data.message;
            activeIsCurrentlyFiltered = data.isCurrentlyFiltered ?? false;

            uiSelectedPksId = data.selectedPksId ?? undefined;
            uiSelectedStartDate = data.startDate ?? undefined;
            uiSelectedEndDate = data.endDate ?? undefined;
            initialLoadComplete = true;
        }
    });

     $: if (data && initialLoadComplete) {
        companyName = data.companyName || "Analitik Palmol";
        statistics = data.statistics || [];
        trendChartData = data.trendChartData;
        pksContributionData = data.pksContributionChartData;
        topTeams = data.topTeams || [];
        topReporters = data.topReporters || [];
        pksListForFilter = data.pksListForFilter || [];
        serverMessage = data.message;
        activeIsCurrentlyFiltered = data.isCurrentlyFiltered ?? false;

        uiSelectedPksId = data.selectedPksId ?? undefined;
        uiSelectedStartDate = data.startDate ?? undefined;
        uiSelectedEndDate = data.endDate ?? undefined;
    }
    
    $: clientError = $page.error as AppError | null;

    $: filterUiHasValues = !!uiSelectedPksId || !!uiSelectedStartDate || !!uiSelectedEndDate;
    $: uiFiltersDifferFromServer = 
        uiSelectedPksId !== (data?.selectedPksId ?? undefined) ||
        uiSelectedStartDate !== (data?.startDate ?? undefined) ||
        uiSelectedEndDate !== (data?.endDate ?? undefined);
    
    $: canApplyFilter = filterUiHasValues && (uiFiltersDifferFromServer || !activeIsCurrentlyFiltered);

    function handlePksUiChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        uiSelectedPksId = target.value === "undefined" ? undefined : target.value;
    }
    function handleStartDateUiChange(detail: string | undefined) { uiSelectedStartDate = detail; }
    function handleEndDateUiChange(detail: string | undefined) { uiSelectedEndDate = detail; }

    function applyFilters() {
        const params = new URLSearchParams();
        if (uiSelectedStartDate && uiSelectedEndDate && (new Date(uiSelectedStartDate) > new Date(uiSelectedEndDate))) {
            alert("Tanggal awal tidak boleh melebihi tanggal akhir."); return;
        }
        if (uiSelectedStartDate) params.set('startDate', uiSelectedStartDate);
        if (uiSelectedEndDate) params.set('endDate', uiSelectedEndDate);
        if (uiSelectedPksId) params.set('pksId', uiSelectedPksId);
        
        const queryString = params.toString();
        const targetUrl = `/dashboards/analytics-palmol${queryString ? '?' + queryString : ''}`;
        if ($page.url.href !== new URL(targetUrl, $page.url.origin).href || (filterUiHasValues && !activeIsCurrentlyFiltered) ) {
            goto(targetUrl, { invalidateAll: true, keepFocus: true });
        } else if (!filterUiHasValues && activeIsCurrentlyFiltered) {
            clearFilters();
        }
    }

    function clearFilters() {
        goto(`/dashboards/analytics-palmol`, { invalidateAll: true, keepFocus: true });
    }

    const trendChartColors = ['#03A9F4', '#FF9800'];
    const baseTrendChartOptions: ApexOptions = {
        chart: { type: "line", height: 380, toolbar: { show: true, tools: { download: true } }, zoom: { enabled: true} },
        dataLabels: { enabled: false },
        stroke: { curve: "smooth", width: [3, 2], dashArray: [0, 3] },
        xaxis: { type: 'category', labels: { rotate: -45, style: { fontSize: '10px' }, trim: true }, tooltip: { enabled: false } },
        yaxis: [
            { seriesName: 'Total Berat (kg)', title: { text: 'Total Berat (kg)', style: { color: trendChartColors[0], fontWeight: 600 } }, labels: { formatter: (val: number) => val.toLocaleString('id-ID') + " kg" }, axisTicks: {show: true}, axisBorder: {show: true, color: trendChartColors[0]}},
            { seriesName: 'Jumlah Laporan', opposite: true, title: { text: 'Jumlah Laporan', style: { color: trendChartColors[1], fontWeight: 600 } }, labels: { formatter: (val: number) => val.toLocaleString('id-ID') }, axisTicks: {show: true}, axisBorder: {show: true, color: trendChartColors[1]}}
        ],
        tooltip: { x: { format: 'MMM yy' }, shared: true, intersect: false, 
            y: { formatter: (val, { seriesIndex, w }) => `${w.config.series[seriesIndex].name}: ${val.toLocaleString('id-ID')} ${seriesIndex === 0 ? 'kg' : ''}` }
        },
        colors: trendChartColors,
        grid: { borderColor: '#f1f3fa', strokeDashArray: 4 },
        legend: { position: 'top', horizontalAlign: 'center', offsetY: -5}
    };

    const pieChartColors = ['#0ab39c', '#299cdb', '#f7b84b', '#f06548', '#6c757d', '#343a40', '#adb5bd'];
    const basePieChartOptions: ApexOptions = {
        chart: { type: 'donut', height: 380 },
        plotOptions: { pie: { donut: { size: '60%' } } },
        legend: { 
            position: 'bottom', horizontalAlign: 'center', offsetY: 0, 
            itemMargin: { horizontal: 8, vertical: 3 }, markers: { size: 8 } 
        },
        dataLabels: { 
            enabled: true, 
            formatter: (val: number, opts: { seriesIndex: number; w: any }) => {
                const label = opts.w.globals.labels?.[opts.seriesIndex];
                return label ? `${label}: ${val.toFixed(1)}%` : `${val.toFixed(1)}%`;
            },
            style: { fontSize: '11px', fontWeight: 'bold' },
            dropShadow: { enabled: true, top: 1, left: 1, blur: 1, opacity: 0.45 }
        },
        tooltip: { 
            y: { 
                formatter: (val: number, { seriesIndex, w }: { seriesIndex: number; dataPointIndex: number; w: any }) => {
                    const label = w.globals.labels?.[seriesIndex];
                    const actualValue = w.globals.series?.[seriesIndex]; 
                    return label && actualValue !== undefined ? `${label}: ${actualValue.toLocaleString('id-ID')} kg` : `${val.toLocaleString('id-ID')} kg`;
                } 
            } 
        },
        colors: pieChartColors,
        labels: [],
    };

    $: finalTrendOptions = trendChartData && trendChartData.categories && trendChartData.series ? {
        ...baseTrendChartOptions,
        series: trendChartData.series,
        xaxis: { ...baseTrendChartOptions.xaxis, categories: trendChartData.categories }
    } : { ...baseTrendChartOptions, series: [{ name: 'Total Berat (kg)', data: [] }, { name: 'Jumlah Laporan', data: [] }], xaxis: {...baseTrendChartOptions.xaxis, categories: []} };

    $: finalPksPieOptions = pksContributionData && pksContributionData.series && pksContributionData.labels && pksContributionData.series.length > 0 ? {
        ...basePieChartOptions,
        series: pksContributionData.series,
        labels: pksContributionData.labels
    } : { ...basePieChartOptions, series: [], labels: ["Tidak ada data"]};

</script>

<DefaultLayout {data}>
    <PageBreadcrumb 
        title={`Analitik Palmol ${data.selectedPksId && data.pksListForFilter?.find(p=>p.id===data.selectedPksId) ? '- PKS ' + (data.pksListForFilter.find(p=>p.id===data.selectedPksId)?.name || '') : (companyName !== 'Analitik Palmol' ? '' : '') }`} 
        subTitle="Dashboard Produktivitas" />

    <div class="mb-4">
        <Card>
            <CardBody>
                <h5 class="card-title mb-3"><Icon icon="mdi:filter-cog-outline" class="me-1"/> Filter Data Analitik</h5>
                <Row class="g-3 align-items-stretch">
                    <Col lg class="d-flex">
                        <FormGroup class="w-100 mb-lg-0">
                            <Label for="pks-filter-analytics" class="form-label-sm">PKS (Opsional):</Label>
                            <Input type="select" id="pks-filter-analytics" bsSize="sm" value={uiSelectedPksId ?? "undefined"} on:change={handlePksUiChange}>
                                <option value="undefined">Semua PKS</option>
                                {#each pksListForFilter as pksItem (pksItem.id)}
                                    <option value={pksItem.id}>{pksItem.name}</option>
                                {/each}
                            </Input>
                        </FormGroup>
                    </Col>
                    <Col lg class="d-flex">
                        <FormGroup class="w-100 mb-lg-0">
                            <Label for="startDate-picker-analytics" class="form-label-sm">Tanggal Awal:</Label>
                            <FlatPicker id="startDate-picker-analytics" placeholder="Pilih Tgl Awal..." options={{ dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y' }} value={uiSelectedStartDate} on:change={(e) => handleStartDateUiChange(e.detail)} class="form-control-sm w-100" />
                        </FormGroup>
                    </Col>
                    <Col lg class="d-flex">
                        <FormGroup class="w-100 mb-lg-0">
                            <Label for="endDate-picker-analytics" class="form-label-sm">Tanggal Akhir:</Label>
                            <FlatPicker id="endDate-picker-analytics" placeholder="Pilih Tgl Akhir..." options={{ dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y', minDate: uiSelectedStartDate }} value={uiSelectedEndDate} on:change={(e) => handleEndDateUiChange(e.detail)} class="form-control-sm w-100"/>
                        </FormGroup>
                    </Col>
                    <Col lg="auto" md="12" class="d-flex flex-column justify-content-end">
                        <Button color="primary" size="sm" on:click={applyFilters} class="w-100 mb-1" disabled={!canApplyFilter}>
                            <Icon icon="mdi:magnify"/> Terapkan
                        </Button>
                        {#if activeIsCurrentlyFiltered}
                            <Button color="outline-secondary" size="sm" on:click={clearFilters} class="w-100">
                                <Icon icon="mdi:filter-remove-outline"/> Hapus
                            </Button>
                        {/if}
                    </Col>
                </Row>
            </CardBody>
        </Card>
    </div>

    {#if clientError}
        <Alert color="danger" class="text-center py-4 fs-5"><Icon icon="mdi:alert-octagon-outline" class="me-2"/>{clientError.message}</Alert>
    {:else if serverMessage && (!statistics || statistics.length === 0) && (!topTeams || topTeams.length === 0) && (!topReporters || topReporters.length === 0) }
        <Alert color="info" class="text-center py-4">
            <Icon icon="mdi:information-outline" style="font-size: 1.8rem; vertical-align:middle;" class="me-2"/>
            <span class="fs-5">{serverMessage}</span>
        </Alert>
    {:else if !statistics.length && !trendChartData?.series?.[0]?.data?.length && !pksContributionData?.series?.length && (!topTeams || topTeams.length === 0) && (!topReporters || topReporters.length === 0) && !initialLoadComplete }
         <div class="text-center py-5 my-5">
            <Spinner style="width: 3.5rem; height: 3.5rem;" color="primary" type="grow"/>
            <p class="mt-3 fs-5 text-muted">Memuat data analitik Anda...</p>
        </div>
    {:else}
        <Row class="row-deck">
            {#each statistics as item (item.title)}
                <Col md="6" xl="3" class="mb-4 d-flex">
                     <StatisticsCard {item} class="w-100 shadow-sm card-lift"/>
                </Col>
            {/each}
        </Row>

        <Row class="mt-0 row-deck">
            <Col xl="7" class="mb-4 d-flex">
                <Card class="h-100 shadow-sm card-lift w-100">
                    <CardHeader class="bg-light border-bottom-0 py-3"><CardTitle class="mb-0 fs-1rem fw-medium"><Icon icon="mdi:chart-areaspline-variant" class="me-2 text-primary"/>Tren Produktivitas Panen</CardTitle></CardHeader>
                    <CardBody class="pt-0">
                        {#if finalTrendOptions.series && finalTrendOptions.series[0]?.data.length > 0}
                            <ApexChart id="palmol-trend-chart" options={finalTrendOptions} />
                        {:else}
                            <p class="text-muted text-center py-5 my-4">Tidak ada data tren untuk periode ini.</p>
                        {/if}
                    </CardBody>
                </Card>
            </Col>
            <Col xl="5" class="mb-4 d-flex">
                <Card class="h-100 shadow-sm card-lift w-100">
                    <CardHeader class="bg-light border-bottom-0 py-3"><CardTitle class="mb-0 fs-1rem fw-medium"><Icon icon="mdi:chart-pie" class="me-2 text-primary"/>Kontribusi Berat per PKS</CardTitle></CardHeader>
                    <CardBody class="d-flex justify-content-center align-items-center">
                        {#if finalPksPieOptions && finalPksPieOptions.series?.length > 0 && finalPksPieOptions.labels?.[0] !== "Tidak ada data"}
                             <ApexChart id="pks-contribution-chart" options={finalPksPieOptions} />
                        {:else}
                            <p class="text-muted text-center py-5 my-4">Tidak ada data kontribusi PKS.</p>
                        {/if}
                    </CardBody>
                </Card>
            </Col>
        </Row>

        <Row class="mt-0 row-deck">
             <Col lg="6" class="mb-4 d-flex">
                <Card class="h-100 shadow-sm card-lift w-100">
                    <CardHeader class="bg-light border-bottom-0 py-3"><CardTitle class="mb-0 fs-1rem fw-medium"><Icon icon="mdi:trophy-outline" class="me-2 text-primary"/>Peringkat Tim Terproduktif (Top 10)</CardTitle></CardHeader>
                    <CardBody class="pt-1">
                        {#if topTeams.length > 0}
                        <div class="table-responsive">
                            <Table hover class="table-sm align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th class="ps-3">No.</th>
                                        <th>Nama Tim (PKS)</th>
                                        <th class="text-end">Total Berat (kg)</th>
                                        <th class="text-center">Jml. Laporan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each topTeams as team, i (team.id)}
                                    <tr>
                                        <td class="ps-3">{i + 1}</td>
                                        <td><Icon icon="mdi:account-group" class="me-1 text-muted"/> {team.name}</td>
                                        <td class="text-end fw-medium">{(team.totalBerat || 0).toLocaleString('id-ID')}</td>
                                        <td class="text-center">{(team.reportCount || 0).toLocaleString('id-ID')}</td>
                                    </tr>
                                    {/each}
                                </tbody>
                            </Table>
                        </div>
                        {:else}
                            <p class="text-muted text-center py-5 my-4">Tidak ada data peringkat tim.</p>
                        {/if}
                    </CardBody>
                </Card>
            </Col>
             <Col lg="6" class="mb-4 d-flex">
                <Card class="h-100 shadow-sm card-lift w-100">
                    <CardHeader class="bg-light border-bottom-0 py-3"><CardTitle class="mb-0 fs-1rem fw-medium"><Icon icon="mdi:account-star-outline" class="me-2 text-primary"/>Peringkat Pelapor Terproduktif (Top 10)</CardTitle></CardHeader>
                    <CardBody class="pt-1">
                        {#if topReporters.length > 0}
                        <div class="table-responsive">
                            <Table hover class="table-sm align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th class="ps-3">No.</th>
                                        <th>Nama Pelapor</th>
                                        <th class="text-end">Total Berat (kg)</th>
                                        <th class="text-center">Jml. Laporan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each topReporters as item, i (item.id)}
                                    <tr>
                                        <td class="ps-3">{i + 1}</td>
                                        <td><Icon icon="mdi:account-circle" class="me-1 text-muted"/> {item.name}</td>
                                        <td class="text-end fw-medium">{(item.totalBerat || 0).toLocaleString('id-ID')}</td>
                                        <td class="text-center">{(item.reportCount || 0).toLocaleString('id-ID')}</td>
                                    </tr>
                                    {/each}
                                </tbody>
                            </Table>
                        </div>
                        {:else}
                            <p class="text-muted text-center py-5 my-4">Tidak ada data peringkat pelapor.</p>
                        {/if}
                    </CardBody>
                </Card>
            </Col>
        </Row>
    {/if}
</DefaultLayout>

<style>
    :global(input.form-control-sm.flatpickr-input) { 
        height: calc(1.5em + 0.5rem + 2px); 
        padding: 0.25rem 0.5rem; 
        font-size: 0.875rem; 
    }
</style>