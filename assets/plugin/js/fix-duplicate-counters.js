/**
 * Script pour corriger le problème des compteurs de devis dupliqués
 */
jQuery(document).ready(function($) {
    // Fonction pour nettoyer les doublons de compteur de devis
    function cleanupDuplicateCounters() {
        // Garder uniquement le premier compteur de devis
        var devisCounters = $('.cpf-text-center.cpf-mt-3.cpf-text-sm');
        if (devisCounters.length > 1) {
            devisCounters.not(':first').remove();
        }
        
        // Supprimer les compteurs ajoutés dynamiquement
        $('.cpf-devis-count').not(':first').remove();
    }
    
    // Exécuter immédiatement
    cleanupDuplicateCounters();
    
    // Exécuter après un court délai pour s'assurer que tout est chargé
    setTimeout(function() {
        cleanupDuplicateCounters();
    }, 500);
    
    // Exécuter après le chargement complet de la page
    $(window).on('load', function() {
        cleanupDuplicateCounters();
        
        // Réexécuter après un court délai
        setTimeout(function() {
            cleanupDuplicateCounters();
        }, 1000);
    });
});
