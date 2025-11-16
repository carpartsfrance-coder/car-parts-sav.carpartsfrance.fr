/**
 * Script pour optimiser les performances sur mobile
 */
jQuery(document).ready(function($) {
    // Fonction pour optimiser le chargement sur mobile
    function optimizeMobilePerformance() {
        // Détecter si l'appareil est mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Différer le chargement des ressources non critiques
            setTimeout(function() {
                // Charger les polices web après le rendu initial
                $('head').append('<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">');
            }, 100);
            
            // Optimiser les animations pour mobile
            $('.cpf-container').css({
                'animation-duration': '0.3s'
            });
            
            // Réduire la complexité des ombres pour améliorer les performances
            $('.cpf-form-step-content, .cpf-benefits-banner, .cpf-btn').css({
                'box-shadow': '0 1px 3px rgba(0, 0, 0, 0.08)'
            });
            
            // Optimiser les transitions pour les appareils à faible puissance
            $('*').css({
                'transition-duration': '0.2s'
            });
            
            // Désactiver les effets hover sur mobile pour améliorer les performances
            $('.cpf-step:not(.active)').css({
                'transform': 'none'
            });
            
            // Optimiser le scroll
            $('body').css({
                'scroll-behavior': 'auto',
                '-webkit-overflow-scrolling': 'touch'
            });
        }
    }
    
    // Exécuter l'optimisation au chargement
    optimizeMobilePerformance();
    
    // Réexécuter lors du redimensionnement
    $(window).on('resize', function() {
        optimizeMobilePerformance();
    });
});
