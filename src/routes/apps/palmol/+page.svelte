<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { page } from '$app/stores';
    import type { PageData } from './$types'; // Akan mengambil tipe dari +page.server.ts
    import type { PKS, AppError, UserSessionData, MenuItemType } from '$lib/types'; // Impor AppError, UserSessionData, MenuItemType
    import { Card, CardBody, CardTitle, Button, Row, Col, Alert, Spinner, Badge } from "@sveltestrap/sveltestrap"; // CardSubtitle, CardText dihapus jika tidak digunakan
    import Icon from '@iconify/svelte';
    // Tidak ada lagi impor firebase client di sini

    export let data: PageData;

    // Data untuk DefaultLayout dari root layout
    let layoutPageData: { userSession: UserSessionData | undefined; menuItemsForLayout: MenuItemType[] };
    $: layoutPageData = {
        userSession: $page.data.userSession as UserSessionData | undefined,
        menuItemsForLayout: ($page.data.menuItemsForLayout as MenuItemType[]) || []
    };

    let pksList: PKS[] = [];
    let messageFromServer: string | null | undefined = undefined; // Untuk pesan seperti "Tidak ada PKS"

    // Mengambil error kritis dari SvelteKit
    $: criticalError = $page.error as AppError | null;

    // Reaksi terhadap perubahan data dari server
    $: {
        if (data && !criticalError) {
            pksList = data.pksList || [];
            messageFromServer = data.message; // Pesan dari server, bisa null
        } else if (criticalError) {
            pksList = []; // Kosongkan list jika ada error kritis
            messageFromServer = null;
        }
    }

    const defaultPksImage = '/images/pks/default-pks.png';

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultPksImage;
    }

    function getMembershipBadgeColor(membership?: string | null): string {
        if (!membership) return 'light';
        switch (membership.toLowerCase()) {
            case 'premium': return 'warning';
            case 'standard': return 'info';
            default: return 'light';
        }
    }
</script>

<DefaultLayout data={layoutPageData}>
    <PageBreadcrumb title="Daftar PKS (Palmol)" subTitle="Aplikasi Palmol" />

    <div class="pt-3">
        <Row class="align-items-center mb-4">
            <Col>
                <h1 class="h3 mb-0 text-dark">Pabrik Kelapa Sawit Terdaftar</h1>
            </Col>
            </Row>

        {#if criticalError}
            <Alert color="danger" class="shadow-sm">
                <h4 class="alert-heading">
                    <Icon icon="mdi:alert-octagon-outline" class="me-2"/>Terjadi Kesalahan Server
                </h4>
                <p>Tidak dapat memuat daftar PKS. <br/><small>Detail: {criticalError.message}</small></p>
            </Alert>
        {:else if pksList.length > 0}
            <Row class="row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
                {#each pksList as pksItem (pksItem.id)}
                    <Col class="d-flex align-items-stretch">
                        <Card class="h-100 shadow-sm border-light card-hover-lift w-100">
                            <a href={`/apps/palmol/${pksItem.pksId || pksItem.id}/teams`} class="text-decoration-none d-flex flex-column h-100">
                                <div style="height: 180px; overflow: hidden; background-color: #f0f2f5; border-top-left-radius: var(--bs-card-inner-border-radius); border-top-right-radius: var(--bs-card-inner-border-radius);">
                                    {#if pksItem.avatar}
                                        <img
                                            src={pksItem.avatar}
                                            alt="Logo {pksItem.pksName}"
                                            class="card-img-top"
                                            style="object-fit: cover; width: 100%; height: 100%;"
                                            on:error={handleImageError}
                                        />
                                    {:else}
                                        <div class="d-flex align-items-center justify-content-center h-100">
                                            <Icon icon="mdi:factory-alt" style="font-size: 4rem; color: #adb5bd;"/>
                                        </div>
                                    {/if}
                                </div>
                                <CardBody class="d-flex flex-column p-3 flex-grow-1">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <h5 class="card-title mb-0 text-dark text-truncate" title={pksItem.pksName} style="max-width: 70%;">
                                            {pksItem.pksName}
                                        </h5>
                                        {#if pksItem.membership && pksItem.membership.toLowerCase() !== 'none'}
                                            <Badge color={getMembershipBadgeColor(pksItem.membership)} pill class="text-uppercase px-2 py-1" style="font-size: 0.7rem;">
                                                {pksItem.membership}
                                            </Badge>
                                        {/if}
                                    </div>

                                    {#if pksItem.address}
                                        <div class="d-flex align-items-center text-muted mb-1" style="font-size: 0.85rem;">
                                            <Icon icon="mdi:map-marker-outline" class="me-2 flex-shrink-0" style="font-size: 1rem;"/>
                                            <span class="text-truncate" title={pksItem.address}>{pksItem.address}</span>
                                        </div>
                                    {/if}
                                    {#if pksItem.email}
                                        <div class="d-flex align-items-center text-muted mb-1" style="font-size: 0.85rem;">
                                            <Icon icon="mdi:email-outline" class="me-2 flex-shrink-0" style="font-size: 1rem;"/>
                                            <a href="mailto:{pksItem.email}" class="text-muted text-truncate" on:click|stopPropagation title={pksItem.email}>{pksItem.email}</a>
                                        </div>
                                    {/if}
                                    {#if pksItem.phoneNumber}
                                        <div class="d-flex align-items-center text-muted mb-2" style="font-size: 0.85rem;">
                                            <Icon icon="mdi:phone-outline" class="me-2 flex-shrink-0" style="font-size: 1rem;"/>
                                            <a href="tel:{pksItem.phoneNumber}" class="text-muted" on:click|stopPropagation>{pksItem.phoneNumber}</a>
                                        </div>
                                    {/if}

                                    <div class="mt-auto d-flex justify-content-between align-items-center pt-2 border-top mt-2">
                                        <small class="text-muted" style="font-size: 0.75rem;">
                                            {#if pksItem.updatedDateFormatted && pksItem.updatedDateFormatted !== 'N/A'}
                                                Update: {pksItem.updatedDateFormatted}
                                            {:else if pksItem.createdDateFormatted && pksItem.createdDateFormatted !== 'N/A'}
                                                Dibuat: {pksItem.createdDateFormatted}
                                            {:else}
                                                ID: {pksItem.pksId || pksItem.id}
                                            {/if}
                                        </small>
                                        <Button color="primary" size="sm" outline class="py-1 px-2" style="font-size: 0.8rem;">
                                            Detail PKS <Icon icon="mdi:arrow-right" class="ms-1" style="font-size: 1rem; vertical-align: -2px;"/>
                                        </Button>
                                    </div>
                                </CardBody>
                            </a>
                        </Card>
                    </Col>
                {/each}
            </Row>
        {:else if messageFromServer}
            <Alert color="info" class="shadow-sm text-center">{messageFromServer}</Alert>
        {:else} <div class="text-center py-5">
                <Spinner color="primary" style="width: 3rem; height: 3rem;"/>
                <p class="mt-3 text-muted">Memuat daftar PKS Anda...</p>
            </div>
        {/if}
    </div>
</DefaultLayout>