<script lang="ts">
    const logoSm = "/images/logo-sm.png"
    const logoLight = "/images/logo-light.png"
    const logoDark = "/images/logo-dark.png"


    export let logoSmHeight: number = 300;
    export let logoLgHeight: number = 300;

</script>

<div class="logo-box">
    <a href="/" class="logo-dark">
        <img src={logoSm} class="logo-sm" height={logoSmHeight} alt="logo sm"/>
        <img src={logoDark} class="logo-lg" height={logoLgHeight} alt="logo dark"/>
    </a>

    <a href="/" class="logo-light">
        <img src={logoSm} class="logo-sm" height={logoSmHeight} alt="logo sm"/>
        <img src={logoLight} class="logo-lg" height={logoLgHeight} alt="logo light"/>
    </a>
</div>