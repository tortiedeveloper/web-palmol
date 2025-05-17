<script lang="ts">
    import { Card, CardBody, Button, Badge } from "@sveltestrap/sveltestrap";
    import type { Tree } from "$lib/types";
    import Icon from '@iconify/svelte';

    export let tree: Tree;
    export let onViewPhoto: (tree: Tree) => void;
    export let onViewTimeline: (tree: Tree) => void;

    // Tambahkan ini untuk menerima class sebagai prop
    let className = '';
    export { className as class }; // Ekspor 'className' sebagai prop 'class'


    const defaultTreeImage = '/images/trees/default-tree.jpg';

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultTreeImage;
    }

    function getStatusBadge(status: string | undefined): { color: string, text: string, icon: string } {
        const s = status?.toLowerCase();
        if (s === 'sick') return { color: 'danger', text: 'Sakit (Ganoderma)', icon: 'mdi:virus-off-outline' };
        if (s === 'recovered') return { color: 'success', text: 'Sudah Pulih', icon: 'healthicons:health-outline-24px' };
        if (s === 'maintenance') return { color: 'info', text: 'Dalam Perawatan', icon: 'mdi:tools' };
        return { color: 'secondary', text: status || 'N/A', icon: 'mdi:help-circle-outline' };
    }
    const statusInfo = getStatusBadge(tree.last_status);
</script>

<Card class="h-100 d-flex flex-column {className || ''} {$$props.class || ''}">
    {#if tree.img}
        <img 
            src={tree.img} 
            alt="Foto {tree.name}" 
            class="card-img-top" 
            style="height: 200px; object-fit: cover;"
            on:error={handleImageError}
        />
    {:else}
        <div class="bg-light d-flex align-items-center justify-content-center" style="height: 200px;">
            <Icon icon="mdi:image-off-outline" style="font-size: 4rem; color: #ccc;"/>
        </div>
    {/if}
    <CardBody class="d-flex flex-column flex-grow-1 p-3">
        <h5 class="card-title fs-16 mb-1 text-truncate">
            {tree.name || 'Nama Pohon Tidak Ada'} <small class="text-muted fw-normal">({tree.id?.substring(0,8) || 'N/A'})</small>
        </h5>

        <div class="mb-2">
            <Badge color={statusInfo.color} pill class="px-2 py-1">
                <Icon icon={statusInfo.icon} class="me-1" style="vertical-align: -2px;"/>
                {statusInfo.text}
            </Badge>
        </div>

        {#if tree.updatedDateFormatted}
            <p class="card-text text-muted mb-1" style="font-size: 0.8rem;">
                <Icon icon="mdi:calendar-clock-outline" class="me-1" style="vertical-align: -2px;"/>
                Update: {tree.updatedDateFormatted}
            </p>
        {/if}

        {#if tree.userName}
            <p class="card-text text-muted mb-2" style="font-size: 0.8rem;">
                <Icon icon="mdi:account-edit-outline" class="me-1" style="vertical-align: -2px;"/>
                Oleh: {tree.userName}
            </p>
        {/if}

        <div class="mt-auto d-flex gap-2">
            {#if tree.img}
            <Button size="sm" color="light" outline on:click={() => onViewPhoto(tree)} class="flex-grow-1">
                <Icon icon="mdi:image-outline" class="me-1"/> Foto
            </Button>
            {/if}
            <Button size="sm" color="primary" outline on:click={() => onViewTimeline(tree)} class="flex-grow-1">
                <Icon icon="mdi:timeline-text-outline" class="me-1"/> Riwayat
            </Button>
        </div>
    </CardBody>
</Card>