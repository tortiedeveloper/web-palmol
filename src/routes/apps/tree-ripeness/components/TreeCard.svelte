<script lang="ts">
    import { Card, CardBody, Button, Badge } from "@sveltestrap/sveltestrap";
    import type { Tree, FruitCounts } from "$lib/types"; // Pastikan FruitCounts diimpor
    import Icon from '@iconify/svelte';

    export let tree: Tree;
    export let onViewPhoto: (tree: Tree) => void;
    export let onViewTimeline: (tree: Tree) => void;
    let className = '';
    export { className as class };

    const defaultTreeImage = '/images/trees/default-tree.jpg';

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultTreeImage;
    }

    // Fungsi untuk styling status berdasarkan fruitCounts
    function getRipenessStatusInfo(fruitCounts?: FruitCounts): { color: string, text: string, icon: string } {
        if (!fruitCounts) return { color: 'secondary', text: 'Data Buah N/A', icon: 'mdi:help-circle-outline' };
        if (fruitCounts.terlaluMatang > 0) return { color: 'warning', text: 'Ada Terlalu Matang', icon: 'mdi:fruit-cherries-off' }; // atau danger
        if (fruitCounts.matang > 0) return { color: 'success', text: 'Siap Panen', icon: 'mdi:fruit-cherries' };
        if (fruitCounts.belumMatang > 0) return { color: 'info', text: 'Belum Matang', icon: 'mdi:fruit-cherries-outline' }; // atau warning/info
        return { color: 'secondary', text: 'Tidak Ada Buah', icon: 'mdi:fruit-cherries-off-outline' };
    }
    const ripenessInfo = getRipenessStatusInfo(tree.fruitCounts);
</script>

<Card class="h-100 d-flex flex-column {className || ''} {$$props.class || ''}">
    {#if tree.img}
        <img 
            src={tree.img} 
            alt="Foto {tree.name}" 
            class="card-img-top" 
            style="height: 180px; object-fit: cover;"
            on:error={handleImageError}
        />
    {:else}
        <div class="bg-light d-flex align-items-center justify-content-center" style="height: 180px;">
            <Icon icon="mdi:image-off-outline" style="font-size: 3.5rem; color: #ccc;"/>
        </div>
    {/if}
    <CardBody class="d-flex flex-column flex-grow-1 p-3">
        <h5 class="card-title fs-16 mb-1 text-truncate" title={tree.name || 'Nama Pohon Tidak Ada'}>
            {tree.name || 'Nama Pohon Tidak Ada'}
        </h5>
        <p class="text-muted fw-normal mb-1" style="font-size: 0.75rem;">ID: {tree.id?.substring(0,8) || 'N/A'}</p>
        
        <div class="mb-2">
            <Badge color={ripenessInfo.color} pill class="px-2 py-1">
                <Icon icon={ripenessInfo.icon} class="me-1" style="vertical-align: -2px;"/>
                {ripenessInfo.text}
            </Badge>
        </div>

        {#if tree.fruitCounts}
        <div style="font-size: 0.8rem;" class="mb-2">
            <div>Matang: <span class="fw-semibold text-success">{tree.fruitCounts.matang || 0}</span></div>
            <div>Belum Matang: <span class="fw-semibold text-warning">{tree.fruitCounts.belumMatang || 0}</span></div>
            <div>Terlalu Matang: <span class="fw-semibold text-danger">{tree.fruitCounts.terlaluMatang || 0}</span></div>
        </div>
        {/if}

        {#if tree.updatedDateFormatted}
            <p class="card-text text-muted mb-1" style="font-size: 0.75rem;">
                <Icon icon="mdi:calendar-clock-outline" class="me-1" style="vertical-align: -1px;"/>
                {tree.updatedDateFormatted}
            </p>
        {/if}

        {#if tree.userName}
            <p class="card-text text-muted mb-2" style="font-size: 0.75rem;">
                <Icon icon="mdi:account-edit-outline" class="me-1" style="vertical-align: -1px;"/>
                {tree.userName}
            </p>
        {/if}

        <div class="mt-auto d-flex gap-2">
            {#if tree.img}
            <Button size="sm" color="light" outline on:click={() => onViewPhoto(tree)} class="flex-grow-1 py-1">
                <Icon icon="mdi:image-outline" class="me-1"/> Foto
            </Button>
            {/if}
            <Button size="sm" color="primary" outline on:click={() => onViewTimeline(tree)} class="flex-grow-1 py-1">
                <Icon icon="mdi:timeline-text-outline" class="me-1"/> Riwayat
            </Button>
        </div>
    </CardBody>
</Card>