<script lang="ts">
    const logoLight = "/images/logo-light.png"
    const logoDark = "/images/logo-dark.png"

    export let logoHeight: number = 35;

</script>

<div class="logo-box">
    <a href="/" class="logo-dark">
        <img src={logoDark} class="logo-lg" height={logoHeight} alt="logo dark"/>
    </a>

    <a href="/" class="logo-light">
        <img src={logoLight} class="logo-lg" height={logoHeight} alt="logo light"/>
    </a>
</div>