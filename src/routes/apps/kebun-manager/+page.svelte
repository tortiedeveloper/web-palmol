<script lang="ts">
    import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
    import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
    import { Card, CardBody, Button, Badge, Progress, Alert, Row, Col } from '@sveltestrap/sveltestrap';
    import Icon from '@iconify/svelte';
    import type { PageData } from './$types';

    export let data: PageData;

    $: kebunList = data.kebunList || [];
    $: groupData = data.groupData;
    $: activeCompanyId = data.activeCompanyId;

    let isSwitching = false;
    let switchError = '';
    let switchSuccess = '';

    async function handleSwitchKebun(companyId: string) {
        if (companyId === activeCompanyId) return;
        
        isSwitching = true;
        switchError = '';
        switchSuccess = '';

        try {
            const response = await fetch('/api/gano-active-company', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ companyId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Gagal mengganti kebun');
            }

            switchSuccess = 'Kebun aktif berhasil diubah!';
            
            // Reload halaman setelah 1 detik
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (err: any) {
            switchError = err.message || 'Terjadi kesalahan saat mengganti kebun';
        } finally {
            isSwitching = false;
        }
    }

    function getQuotaPercentage(): number {
        if (!groupData || groupData.maxHektar <= 0) return 0;
        return Math.min((groupData.totalHektar / groupData.maxHektar) * 100, 100);
    }

    function getQuotaColor(): string {
        const pct = getQuotaPercentage();
        if (pct >= 100) return 'danger';
        if (pct >= 80) return 'warning';
        return 'success';
    }
</script>

<svelte:head>
    <title>Kelola Kebun - GanoAI</title>
</svelte:head>

<DefaultLayout {data}>
    <PageBreadcrumb title="Kelola Kebun" subTitle="Aplikasi GanoAI" />

    <div class="page-container">
        {#if switchSuccess}
            <Alert color="success" dismissible class="mb-3">
                {switchSuccess}
            </Alert>
        {/if}

        {#if switchError}
            <Alert color="danger" dismissible class="mb-3">
                {switchError}
            </Alert>
        {/if}

        {#if groupData}
            <!-- Info Kuota -->
            <Card class="mb-4 border-0 shadow-sm">
                <CardBody>
                    <Row>
                        <Col md={6}>
                            <div class="d-flex justify-content-between mb-2">
                                <span class="fw-bold">Kuota Hektar</span>
                                <span class="fw-bold">
                                    {groupData.totalHektar.toFixed(1)} / {groupData.maxHektar.toFixed(1)} Ha
                                </span>
                            </div>
                            <Progress 
                                value={getQuotaPercentage()} 
                                color={getQuotaColor()} 
                                class="mb-2" 
                                style="height: 8px;"
                            />
                            <div class="d-flex justify-content-between">
                                <small class="text-muted">
                                    Sisa: {(groupData.maxHektar - groupData.totalHektar).toFixed(1)} Ha
                                </small>
                                <small class="text-muted">
                                    {groupData.memberCount} anggota grup
                                </small>
                            </div>
                        </Col>
                        <Col md={6} class="d-flex align-items-center justify-content-md-end mt-3 mt-md-0">
                            {#if groupData.totalHektar < groupData.maxHektar}
                                <Button color="success" disabled={isSwitching}>
                                    <Icon icon="mdi:plus" class="me-1" />
                                    Tambah Kebun
                                </Button>
                            {:else}
                                <Badge color="danger" class="p-2">
                                    <Icon icon="mdi:alert" class="me-1" />
                                    Kuota Penuh
                                </Badge>
                            {/if}
                        </Col>
                    </Row>
                </CardBody>
            </Card>
        {/if}

        <!-- List Kebun -->
        {#if kebunList.length > 0}
            <Row>
                {#each kebunList as kebun}
                    <Col md={6} lg={4} class="mb-3">
                        <Card class="h-100 border-0 shadow-sm {kebun.isActive ? 'border-success border-2' : ''}"
                            style={kebun.isActive ? 'border: 2px solid #198754 !important;' : ''}
                        >
                            <CardBody class="d-flex flex-column">
                                <div class="d-flex justify-content-between align-items-start mb-3">
                                    <div>
                                        <div class="d-flex align-items-center mb-1">
                                            {#if kebun.isActive}
                                                <Badge color="success" class="me-2">Aktif</Badge>
                                            {/if}
                                            <Icon 
                                                icon="mdi:forest" 
                                                class={kebun.isActive ? 'text-success' : 'text-muted'} 
                                                width="24" 
                                                height="24"
                                            />
                                        </div>
                                        <h5 class="mb-1">{kebun.companyName}</h5>
                                        <small class="text-muted">Luas: {kebun.luasKebun} Ha</small>
                                    </div>
                                </div>

                                <div class="mt-auto">
                                    {#if kebun.isActive}
                                        <Button 
                                            color="outline-success" 
                                            size="sm" 
                                            class="w-100"
                                            disabled
                                        >
                                            <Icon icon="mdi:check" class="me-1" />
                                            Kebun Aktif
                                        </Button>
                                    {:else}
                                        <Button 
                                            color="success" 
                                            size="sm" 
                                            class="w-100"
                                            on:click={() => handleSwitchKebun(kebun.id)}
                                            disabled={isSwitching}
                                        >
                                            {#if isSwitching}
                                                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                Memindahkan...
                                            {:else}
                                                <Icon icon="mdi:swap-horizontal" class="me-1" />
                                                Pilih Kebun
                                            {/if}
                                        </Button>
                                    {/if}
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                {/each}
            </Row>
        {:else}
            <Card class="border-0 shadow-sm">
                <CardBody class="text-center py-5">
                    <Icon icon="mdi:forest-off" width="64" height="64" class="text-muted mb-3" />
                    <h5 class="text-muted">Belum ada kebun terdaftar</h5>
                    <p class="text-muted">
                        Anda belum memiliki kebun yang terdaftar dalam grup ini.
                    </p>
                </CardBody>
            </Card>
        {/if}
    </div>
</DefaultLayout>
