/**
 * Gestion des étapes du formulaire de devis CarPartsFrance
 */
jQuery(document).ready(function($) {
    // Variables pour suivre l'état du formulaire
    let currentStep = 1;
    const totalSteps = 3;
    
    // Fonction pour mettre à jour la barre de progression
    function updateProgressBar() {
        const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
        $('#cpf-progress-bar').css('width', progress + '%');
        
        // Mettre à jour les indicateurs d'étape
        $('.cpf-step').removeClass('active completed');
        for (let i = 1; i <= totalSteps; i++) {
            if (i < currentStep) {
                $('.cpf-step[data-step="' + i + '"]').addClass('completed');
            } else if (i === currentStep) {
                $('.cpf-step[data-step="' + i + '"]').addClass('active');
            }
        }
    }
    
    // Fonction pour naviguer entre les étapes
    function goToStep(step) {
        $('.cpf-form-step').hide();
        $('.cpf-form-step[data-step="' + step + '"]').show();
        currentStep = step;
        updateProgressBar();
        
        // Faire défiler automatiquement la page vers le haut du formulaire
        scrollToFormTop();
    }
    
    // Fonction pour faire défiler la page vers le haut du formulaire
    function scrollToFormTop() {
        // Attendre un court instant pour s'assurer que le DOM est bien mis à jour
        setTimeout(function() {
            // Sélectionner l'élément vers lequel défiler (le début du formulaire ou le début de l'étape active)
            let targetElement = $('.cpf-form-step[data-step="' + currentStep + '"] .cpf-form-step-content');
            if (!targetElement.length) {
                targetElement = $('.cpf-container');
            }
            
            // Calculer la position de défilement
            const formTop = targetElement.offset().top - 15; // 15px de marge en haut
            
            // Détecter iOS pour un traitement spécial
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            
            if (isIOS) {
                // Sur iOS, utiliser scrollTo natif qui fonctionne mieux avec l'inertie du défilement
                window.scrollTo({
                    top: formTop,
                    behavior: 'smooth'
                });
            } else {
                // Pour les autres appareils, utiliser l'animation jQuery
                $('html, body').animate({
                    scrollTop: formTop
                }, 300);
            }
        }, 50); // Petit délai pour s'assurer que le DOM est mis à jour
    }
    
    // Événements pour les boutons suivant/précédent
    $('.cpf-next-btn').click(function() {
        const step = parseInt($(this).data('step'));
        
        // Valider l'étape actuelle avant de passer à la suivante
        let isValid = false;
        if (step === 1) {
            isValid = validateStep1();
        } else if (step === 2) {
            isValid = validateStep2();
        }
        
        if (isValid) {
            // Passer à l'étape suivante
            goToStep(step + 1);
        }
    });
    
    $('.cpf-prev-btn').click(function() {
        const step = parseInt($(this).data('step'));
        goToStep(step - 1);
    });
    
    // Bouton pour faire une nouvelle demande
    $('#cpf-new-request-btn').click(function() {
        $('#cpf-devis-form')[0].reset();
        $('#cpf-success-message').hide();
        $('#cpf-devis-form').show();
        goToStep(1);
    });
    
    // Compteur de devis (simulation d'augmentation)
    let devisCount = 127;
    setInterval(function() {
        devisCount++;
        $('#cpf-devis-count').text(devisCount);
    }, 30000);
    
    // Initialiser la barre de progression
    updateProgressBar();
});
