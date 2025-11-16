/**
 * Script pour améliorer le défilement automatique sur mobile
 * Ce script s'assure que le formulaire est toujours visible après un changement d'étape
 */
jQuery(document).ready(function($) {
    // Fonction pour gérer le focus sur les champs de formulaire
    function handleFormFieldFocus() {
        // Sélectionner tous les champs de formulaire
        const formFields = $('.cpf-form-input, .cpf-form-textarea, .cpf-form-select');
        
        // Ajouter un gestionnaire d'événement pour le focus sur les champs
        formFields.on('focus', function() {
            // Marquer le champ comme étant en focus
            $(this).data('has-focus', true);
        });
        
        // Ajouter un gestionnaire d'événement pour la perte de focus
        formFields.on('blur', function() {
            // Marquer le champ comme n'étant plus en focus
            $(this).data('has-focus', false);
        });
    }
    
    // Fonction pour détecter la fermeture du clavier virtuel
    function detectVirtualKeyboardClose() {
        // Hauteur initiale de la fenêtre
        let windowHeight = window.innerHeight;
        
        // Détecter les changements de hauteur de la fenêtre (ouverture/fermeture du clavier)
        window.addEventListener('resize', function() {
            // Si la nouvelle hauteur est plus grande que la hauteur précédente,
            // cela signifie probablement que le clavier virtuel a été fermé
            if (window.innerHeight > windowHeight) {
                // Vérifier si aucun champ n'a le focus
                const noFieldHasFocus = !$('.cpf-form-input, .cpf-form-textarea, .cpf-form-select').is(function() {
                    return $(this).data('has-focus') === true;
                });
                
                // Si aucun champ n'a le focus, ajuster la position de défilement
                if (noFieldHasFocus) {
                    // Trouver l'étape active
                    const activeStep = $('.cpf-form-step:visible');
                    if (activeStep.length) {
                        // Calculer la position de défilement
                        const stepTop = activeStep.offset().top - 15;
                        
                        // Faire défiler la page
                        $('html, body').animate({
                            scrollTop: stepTop
                        }, 200);
                    }
                }
            }
            
            // Mettre à jour la hauteur de la fenêtre
            windowHeight = window.innerHeight;
        });
    }
    
    // Fonction pour améliorer le défilement lors du changement d'étape
    function enhanceStepNavigation() {
        // Sélectionner les boutons de navigation
        const navButtons = $('.cpf-next-btn, .cpf-prev-btn');
        
        // Ajouter un gestionnaire d'événement pour le clic sur les boutons
        navButtons.on('click', function() {
            // Fermer le clavier virtuel si ouvert
            document.activeElement.blur();
            
            // Attendre que le DOM soit mis à jour
            setTimeout(function() {
                // Mettre le focus sur le premier champ de l'étape active
                const firstField = $('.cpf-form-step:visible .cpf-form-input').first();
                if (firstField.length) {
                    // Faire défiler vers le champ sans ouvrir le clavier
                    firstField[0].focus({preventScroll: true});
                    firstField[0].blur();
                }
            }, 100);
        });
    }
    
    // Initialiser les fonctionnalités
    handleFormFieldFocus();
    detectVirtualKeyboardClose();
    enhanceStepNavigation();
});
