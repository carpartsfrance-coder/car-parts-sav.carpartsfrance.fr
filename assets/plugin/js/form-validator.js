/**
 * Validation du formulaire de devis CarPartsFrance
 */
jQuery(document).ready(function($) {
    // Validation de l'étape 1
    function validateStep1() {
        let isValid = true;
        const prenom = $('#cpf-prenom').val().trim();
        const nom = $('#cpf-nom').val().trim();
        const email = $('#cpf-email').val().trim();
        const telephone = $('#cpf-telephone').val().trim();
        
        // Réinitialiser les erreurs
        $('.cpf-form-error').text('');
        
        // Valider prénom et nom
        if (!prenom) {
            $('#cpf-prenom-error').text('Le prénom est requis');
            isValid = false;
        }
        
        if (!nom) {
            $('#cpf-nom-error').text('Le nom est requis');
            isValid = false;
        }
        
        // Valider qu'au moins un moyen de contact est fourni
        if (!email && !telephone) {
            $('#cpf-email-error').text('Veuillez fournir au moins un moyen de contact');
            $('#cpf-telephone-error').text('Veuillez fournir au moins un moyen de contact');
            isValid = false;
        } else {
            // Si email est fourni, valider son format
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                $('#cpf-email-error').text('Format d\'email invalide');
                isValid = false;
            }
            
            // Si téléphone est fourni, valider son format avec une expression régulière plus permissive
            // Accepte les formats internationaux, français, DOM-TOM, européens, etc.
            if (telephone) {
                // Nettoyer le numéro pour l'analyse (garder uniquement les chiffres, +, et espaces)
                const cleanedPhone = telephone.replace(/[^0-9+\s]/g, '');
                
                // Vérifier si c'est un format valide (commence par + ou 0, suivi de chiffres, longueur totale entre 8 et 20)
                if (!/^(?:[+]|0)[0-9\s]{7,19}$/.test(cleanedPhone)) {
                    $('#cpf-telephone-error').text('Format de téléphone invalide');
                    isValid = false;
                }
            }
        }
        
        return isValid;
    }
    
    // Validation de l'étape 2
    function validateStep2() {
        let isValid = true;
        const immatriculation = $('#cpf-immatriculation').val().trim();
        const vin = $('#cpf-vin').val().trim();
        
        // Réinitialiser les erreurs
        $('.cpf-form-error').text('');
        
        // Valider qu'au moins une information véhicule est fournie
        if (!immatriculation && !vin) {
            $('#cpf-immatriculation-error').text('Veuillez fournir au moins une information d\'identification');
            $('#cpf-vin-error').text('Veuillez fournir au moins une information d\'identification');
            isValid = false;
        }
        
        return isValid;
    }
    
    // Validation de l'étape 3
    function validateStep3() {
        let isValid = true;
        const consentement = $('#cpf-consentement').is(':checked');
        
        // Réinitialiser les erreurs
        $('.cpf-form-error').text('');
        
        // Valider le consentement
        if (!consentement) {
            $('#cpf-consentement-error').text('Vous devez accepter les conditions d\'utilisation');
            isValid = false;
        }
        
        return isValid;
    }
    
    // Exposer les fonctions de validation globalement
    window.validateStep1 = validateStep1;
    window.validateStep2 = validateStep2;
    window.validateStep3 = validateStep3;
    
    // Soumission du formulaire
    $('#cpf-devis-form').submit(function(e) {
        e.preventDefault();
        
        // Valider l'étape finale
        if (!validateStep3()) {
            return false;
        }
        
        // Désactiver le bouton de soumission et afficher un indicateur de chargement
        $('#cpf-submit-btn').prop('disabled', true).text('Envoi en cours...');
        
        // Préparer les données du formulaire
        const formData = new FormData(this);
        formData.append('action', 'cpf_submit_devis_form');
        formData.append('nonce', $('#cpf_nonce').val());
        
        // Envoyer la requête AJAX
        $.ajax({
            url: cpfDevisForm.ajaxurl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    // Afficher le message de succès
                    $('#cpf-devis-form').hide();
                    $('#cpf-success-message').show();
                    
                    // Afficher la référence
                    if (response.data.referenceId) {
                        $('#cpf-reference-id').text(response.data.referenceId);
                        $('#cpf-reference-box').show();
                    }
                    
                    // Afficher le message de confirmation par email ou téléphone
                    const email = $('#cpf-email').val().trim();
                    const telephone = $('#cpf-telephone').val().trim();
                    
                    if (email) {
                        $('#cpf-email-sent').text(email);
                        $('#cpf-email-confirmation').show();
                    } else if (telephone) {
                        $('#cpf-telephone-contact').text(telephone);
                        $('#cpf-telephone-confirmation').show();
                    }
                    
                    // Supprimer les données sauvegardées
                    localStorage.removeItem('cpf-devis-form-data');
                } else {
                    alert('Erreur: ' + response.data);
                    $('#cpf-submit-btn').prop('disabled', false).text('Envoyer ma demande');
                }
            },
            error: function() {
                alert('Une erreur est survenue lors de l\'envoi du formulaire. Veuillez réessayer.');
                $('#cpf-submit-btn').prop('disabled', false).text('Envoyer ma demande');
            }
        });
    });
});
