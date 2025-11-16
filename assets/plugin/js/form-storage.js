/**
 * Gestion du stockage local pour le formulaire de devis CarPartsFrance
 */
jQuery(document).ready(function($) {
    // Sauvegarder les données du formulaire dans le stockage local
    function saveFormData() {
        const data = {
            prenom: $('#cpf-prenom').val(),
            nom: $('#cpf-nom').val(),
            email: $('#cpf-email').val(),
            telephone: $('#cpf-telephone').val(),
            immatriculation: $('#cpf-immatriculation').val(),
            vin: $('#cpf-vin').val(),
            referenceOEM: $('#cpf-reference-oem').val(),
            typePiece: $('#cpf-type-piece').val(),
            message: $('#cpf-message').val()
        };
        
        localStorage.setItem('cpf-devis-form-data', JSON.stringify(data));
    }
    
    // Restaurer les données sauvegardées
    function restoreFormData() {
        const savedData = localStorage.getItem('cpf-devis-form-data');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                for (const [key, value] of Object.entries(data)) {
                    $('#cpf-' + key.replace(/([A-Z])/g, '-$1').toLowerCase()).val(value);
                }
            } catch (e) {
                console.error('Erreur lors de la restauration des données:', e);
            }
        }
    }
    
    // Exposer la fonction de sauvegarde globalement
    window.saveFormData = saveFormData;
    
    // Enregistrer les événements pour sauvegarder les données
    $('.cpf-form-input, .cpf-form-textarea, .cpf-form-select').on('change', function() {
        saveFormData();
    });
    
    // Vérifier s'il y a des données sauvegardées au chargement
    restoreFormData();
});
