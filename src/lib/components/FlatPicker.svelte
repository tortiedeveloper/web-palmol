<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from "svelte"; // Impor onDestroy
    import { Input, type InputType } from "@sveltestrap/sveltestrap";

    export let type: InputType = 'text';
    export let placeholder: string;
    export let id: string;
    export let value: string | undefined = undefined; // Nilai awal dari parent
    export let options: object = {};
    let className: string = '';
    export { className as class };

    const dispatch = createEventDispatcher();

    let flatpickrInstance: any = null; // Untuk referensi instance Flatpickr

    onMount(async () => { // onMount bisa tetap async untuk impor
        const flatpickr = (await import('flatpickr')).default;
        const ele = document.getElementById(id) as HTMLInputElement | null; // Beri tipe yang lebih spesifik
        if (ele) {
            flatpickrInstance = flatpickr(ele, {
                ...options,
                defaultDate: value, // Gunakan prop 'value' untuk defaultDate
                onChange: function(selectedDates, dateStr, instance) {
                    // Kirim event 'change' dengan nilai string tanggal baru (dateStr)
                    dispatch('change', dateStr);
                }
            });
        }
        // Tidak perlu return fungsi cleanup dari onMount jika async
    });

    // Gunakan onDestroy untuk cleanup
    onDestroy(() => {
        if (flatpickrInstance) {
            flatpickrInstance.destroy();
            flatpickrInstance = null; // Bersihkan referensi
        }
    });

    // Reaktivitas untuk update nilai Flatpickr jika prop 'value' berubah dari parent
    // Ini berguna untuk 'clearFilter' atau jika nilai di-load secara dinamis
    $: if (flatpickrInstance && typeof window !== 'undefined') {
        const currentPickerValue = (document.getElementById(id) as HTMLInputElement)?.value;
        // Cek apakah nilai prop berbeda dengan apa yang ditampilkan oleh Flatpickr saat ini
        // dan hindari update jika value prop adalah undefined tapi picker sudah kosong
        if (value !== currentPickerValue && !(value === undefined && currentPickerValue === '')) {
             // 'false' untuk parameter kedua setDate agar tidak memicu event onChange lagi dari Flatpickr
            flatpickrInstance.setDate(value, false);
        }
    }

</script>

<Input 
    {type} 
    {id} 
    {placeholder} 
    class={className || ''} 
    value={value ?? ''} readonly 
/>