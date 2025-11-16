/**
 * Script pour appliquer les styles personnalisés au formulaire
 */
jQuery(document).ready(function($) {
    // Appliquer les styles personnalisés avec priorité élevée
    function applyCustomStyles() {
        // Conteneur principal
        $('.cpf-container').css({
            'border-radius': '1rem',
            'box-shadow': '0 10px 25px rgba(0, 0, 0, 0.05)',
            'padding': '2rem',
            'background-color': 'white',
            'font-family': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            'max-width': '1000px',  // Augmenter la largeur maximale
            'width': '100%'         // Assurer que le conteneur prend toute la largeur disponible
        });

        // Bannière de bénéfices
        $('.cpf-benefits-banner').css({
            'background': 'linear-gradient(145deg, #ffffff, #f9fafb)',
            'border': 'none',
            'border-radius': '1rem',
            'padding': '1.5rem',
            'margin-bottom': '2rem',
            'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.05)',
            'position': 'relative',
            'overflow': 'hidden'
        });
        
        // Améliorer la disposition horizontale des bénéfices
        $('.cpf-benefits-grid').css({
            'display': 'flex',
            'flex-wrap': 'wrap',
            'gap': '1rem',
            'justify-content': 'space-between'
        });

        // Ajouter la bordure supérieure colorée à la bannière
        if (!$('.cpf-benefits-banner').find('.banner-top-border').length) {
            $('.cpf-benefits-banner').prepend('<div class="banner-top-border"></div>');
            $('.banner-top-border').css({
                'position': 'absolute',
                'top': '0',
                'left': '0',
                'width': '100%',
                'height': '4px',
                'background': 'linear-gradient(90deg, #e52d27, #10b981)'
            });
        }

        // Éléments de bénéfice
        $('.cpf-benefit-item').css({
            'display': 'flex',
            'align-items': 'flex-start',
            'transition': 'all 0.3s ease',
            'padding': '0.75rem',
            'border-radius': '0.75rem',
            'background-color': 'rgba(255, 255, 255, 0.6)',
            'border': '1px solid rgba(255, 255, 255, 0.8)',
            'margin-bottom': '0.75rem',
            'flex': '1 1 30%',
            'min-width': '220px',
            'max-width': '32%'
        });

        // Icônes de bénéfice
        $('.cpf-benefit-icon').css({
            'display': 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'width': '2rem',
            'height': '2rem',
            'background': 'linear-gradient(135deg, rgba(229, 45, 39, 0.1), rgba(255, 255, 255, 0.8))',
            'color': '#e52d27',
            'border-radius': '0.5rem',
            'margin-right': '0.5rem',
            'flex-shrink': '0',
            'box-shadow': '0 2px 5px rgba(229, 45, 39, 0.1)'
        });
        
        // Améliorer le texte des bénéfices
        $('.cpf-benefit-item p').css({
            'font-size': '0.85rem',
            'line-height': '1.3',
            'margin': '0',
            'color': '#374151'
        });
        
        // Améliorer les icônes
        $('.cpf-benefit-icon').css({
            'width': '2.5rem',
            'height': '2.5rem',
            'background': 'linear-gradient(135deg, #fff5f5, #ffffff)',
            'color': '#e52d27',
            'border-radius': '50%',
            'margin-right': '0.75rem',
            'display': 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'box-shadow': '0 3px 8px rgba(229, 45, 39, 0.15)'
        });
        
        // Optimiser la taille des icônes SVG
        $('.cpf-benefit-icon svg').css({
            'width': '18px',
            'height': '18px'
        });
        
        // Mettre en évidence le texte en gras
        $('.cpf-benefit-item p strong').css({
            'color': '#e52d27',
            'font-weight': '600'
        });

        // Barre de progression
        $('.cpf-progress-bar').css({
            'height': '0.5rem',
            'background-color': '#f3f4f6',
            'border-radius': '1rem',
            'margin': '2rem 0',
            'overflow': 'hidden',
            'position': 'relative',
            'box-shadow': 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
        });

        // Barre de progression intérieure
        $('.cpf-progress-bar-inner').css({
            'height': '100%',
            'background': 'linear-gradient(90deg, #e52d27, #10b981)',
            'transition': 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            'box-shadow': '0 0 10px rgba(229, 45, 39, 0.5)',
            'position': 'relative'
        });

        // Ajouter l'effet de brillance à la barre de progression
        if (!$('.cpf-progress-bar-inner').find('.progress-shimmer').length) {
            $('.cpf-progress-bar-inner').append('<div class="progress-shimmer"></div>');
            $('.progress-shimmer').css({
                'position': 'absolute',
                'top': '0',
                'left': '0',
                'right': '0',
                'bottom': '0',
                'background': 'linear-gradient(90deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.1))',
                'background-size': '200% 100%',
                'animation': 'shimmer 2s infinite'
            });
        }

        // Numéros d'étape
        $('.cpf-step-number').css({
            'width': '2.5rem',
            'height': '2.5rem',
            'border-radius': '50%',
            'background-color': 'white',
            'color': '#9ca3af',
            'display': 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'margin-bottom': '0.75rem',
            'font-weight': '600',
            'transition': 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            'border': '2px solid #e5e7eb',
            'box-shadow': '0 4px 10px rgba(0, 0, 0, 0.05)',
            'position': 'relative',
            'z-index': '2'
        });

        // Étape active
        $('.cpf-step.active .cpf-step-number').css({
            'background': 'linear-gradient(135deg, #e52d27, #c4211c)',
            'color': 'white',
            'transform': 'scale(1.2)',
            'border-color': 'white',
            'box-shadow': '0 0 0 5px rgba(229, 45, 39, 0.1), 0 10px 15px rgba(229, 45, 39, 0.2)'
        });

        // Étape complétée
        $('.cpf-step.completed .cpf-step-number').css({
            'background': 'linear-gradient(135deg, #10b981, #0d9488)',
            'color': 'white',
            'border-color': 'white'
        });

        // Champs de formulaire
        $('.cpf-form-input, .cpf-form-textarea, .cpf-form-select').css({
            'width': '100%',
            'padding': '0.875rem 1rem',
            'border': '1px solid #e5e7eb',
            'border-radius': '0.75rem',
            'font-size': '1rem',
            'background-color': '#f9fafb',
            'transition': 'all 0.3s ease',
            'box-shadow': 'inset 0 2px 4px rgba(0, 0, 0, 0.02)'
        });

        // Boutons
        $('.cpf-btn').css({
            'padding': '0.875rem 1.75rem',
            'border-radius': '0.75rem',
            'font-size': '1rem',
            'font-weight': '600',
            'cursor': 'pointer',
            'border': 'none',
            'transition': 'all 0.3s ease',
            'box-shadow': '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
            'position': 'relative',
            'overflow': 'hidden',
            'z-index': '1',
            'min-width': '150px'
        });
        
        // Améliorer la disposition des boutons
        $('.cpf-form-buttons').css({
            'display': 'flex',
            'justify-content': 'space-between',
            'gap': '1rem',
            'margin-top': '1.5rem'
        });

        // Bouton primaire
        $('.cpf-btn-primary').css({
            'background': 'linear-gradient(135deg, #e52d27, #c4211c)',
            'color': 'white'
        });

        // Bouton secondaire
        $('.cpf-btn-secondary').css({
            'background': 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
            'color': '#4b5563'
        });

        // Sections de formulaire
        $('.cpf-form-section').css({
            'margin-bottom': '2rem',
            'padding': '1.5rem',
            'border': 'none',
            'border-radius': '1rem',
            'background': 'linear-gradient(145deg, #ffffff, #f9fafb)',
            'box-shadow': '0 10px 30px rgba(0, 0, 0, 0.03), 0 1px 8px rgba(0, 0, 0, 0.06)',
            'transition': 'all 0.3s ease',
            'position': 'relative',
            'overflow': 'hidden'
        });
        
        // Améliorer la disposition horizontale des champs
        $('.cpf-form-step-content').css({
            'display': 'flex',
            'flex-wrap': 'wrap',
            'gap': '1.5rem'
        });
        
        // Rendre les groupes de formulaire plus larges
        $('.cpf-form-group').css({
            'flex': '1 1 45%',
            'min-width': '250px'
        });

        // Ajouter la bordure latérale colorée aux sections
        $('.cpf-form-section').each(function() {
            if (!$(this).find('.section-left-border').length) {
                $(this).prepend('<div class="section-left-border"></div>');
                $(this).find('.section-left-border').css({
                    'position': 'absolute',
                    'left': '0',
                    'top': '0',
                    'height': '100%',
                    'width': '4px',
                    'background': 'linear-gradient(to bottom, #e52d27, rgba(229, 45, 39, 0.1))',
                    'opacity': '0.8'
                });
            }
        });

        // Message de succès
        $('#cpf-success-message').css({
            'background': 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.1))',
            'border': 'none',
            'border-radius': '1rem',
            'padding': '2rem',
            'margin-top': '2rem',
            'color': '#10b981',
            'text-align': 'center',
            'position': 'relative',
            'overflow': 'hidden',
            'box-shadow': '0 10px 25px rgba(16, 185, 129, 0.1), 0 5px 10px rgba(16, 185, 129, 0.05)'
        });
    }

    // Fonction pour appliquer les styles mobiles
    function applyMobileStyles() {
        // Fixer les problèmes de débordement sur mobile
        $('body').css({
            'overflow-x': 'hidden'
        });
        
        // S'assurer que le formulaire ne déborde pas
        $('.cpf-container, .cpf-form, .cpf-form-step, .cpf-form-step-content').css({
            'max-width': '100%',
            'overflow-x': 'hidden',
            'box-sizing': 'border-box',
            'word-wrap': 'break-word',  // Évite que le texte déborde
            'word-break': 'break-word'  // Force la coupure des mots longs
        });
        
        // Corriger les problèmes de largeur sur les images et médias
        $('.cpf-container img, .cpf-container video, .cpf-container iframe, .cpf-container svg').css({
            'max-width': '100%',
            'height': 'auto'
        });
        
        // Ajouter une méta viewport si elle n'existe pas déjà
        if (!$('meta[name="viewport"]').length) {
            $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">');
        }
        
        // Styles pour les tablettes (< 768px)
        if (window.innerWidth < 768) {
            // Conteneur principal en version mobile - plus compact
            $('.cpf-container').css({
                'padding': '1rem 1.25rem',
                'border-radius': '0.75rem',
                'max-width': '100%',
                'box-shadow': '0 5px 15px rgba(0, 0, 0, 0.03)'
            });
            
            // Réduire l'espacement vertical global
            $('h2, h3, p, .cpf-mb-4, .cpf-mb-2').css({
                'margin-bottom': '0.5rem'
            });
            
            // Éléments de bénéfice en version mobile - format liste verticale plus élégant
            $('.cpf-benefit-item').css({
                'flex': '1 1 100%',
                'max-width': '100%',
                'margin-bottom': '0.75rem',
                'padding': '0.75rem',
                'display': 'flex',
                'align-items': 'center',
                'background': 'linear-gradient(145deg, #ffffff, #f9fafb)',
                'border-radius': '0.75rem',
                'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.03)',
                'border-left': '3px solid #e52d27'
            });
            
            // Afficher les bénéfices en colonne unique avec meilleur espacement
            $('.cpf-benefits-grid').css({
                'display': 'flex',
                'flex-direction': 'column',
                'gap': '0.5rem'
            });
            
            // Groupes de formulaire en version mobile
            $('.cpf-form-group').css({
                'flex': '1 1 100%',
                'margin-bottom': '1rem',
                'min-width': '0',  // Empêche le débordement des flexbox
                'width': '100%'     // Assure que les groupes prennent toute la largeur
            });
            
            // S'assurer que les champs de formulaire ne débordent pas
            $('.cpf-form-input, .cpf-form-textarea, .cpf-form-select').css({
                'width': '100%',
                'max-width': '100%',
                'box-sizing': 'border-box'
            });
            
            // Boutons en version mobile
            $('.cpf-form-buttons').css({
                'flex-direction': 'column',
                'gap': '0.75rem',
                'width': '100%'
            });
            
            $('.cpf-btn').css({
                'width': '100%',
                'margin': '0.25rem 0',
                'padding': '0.75rem 1rem'
            });
            
            // Ajuster l'espacement des sections en mobile
            $('.cpf-form-section').css({
                'padding': '0.75rem 1rem',
                'margin-bottom': '1rem'
            });
            
            // Optimiser les titres des sections
            $('.cpf-form-section h3').css({
                'margin-bottom': '0.5rem'
            });
            
            // Réduire l'espacement entre les champs
            $('.cpf-form-section .cpf-form-group').css({
                'margin-bottom': '0.5rem'
            });
            
            // Bannière de bénéfices en version mobile - style amélioré
            $('.cpf-benefits-banner').css({
                'padding': '1rem 1.25rem',
                'margin-bottom': '1.25rem',
                'background': 'linear-gradient(145deg, #ffffff, #f9fafb)',
                'border': 'none',
                'border-radius': '1rem',
                'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.04)',
                'position': 'relative',
                'overflow': 'hidden'
            });
            
            // Améliorer le titre de la bannière
            $('.cpf-benefits-banner h3').css({
                'font-size': '0.9rem',
                'margin-bottom': '0.75rem',
                'color': '#374151',
                'font-weight': '600',
                'text-align': 'center'
            });
            
            // Améliorer l'affichage des étoiles et de la note
            $('.cpf-benefits-banner .cpf-flex.cpf-items-center.cpf-mb-3').css({
                'display': 'flex',
                'justify-content': 'center',
                'margin-bottom': '1rem',
                'background': 'linear-gradient(145deg, #fffaf0, #fff8e6)',
                'padding': '0.5rem 0.75rem',
                'border-radius': '0.75rem',
                'width': 'fit-content',
                'margin-left': 'auto',
                'margin-right': 'auto'
            });
            
            // Améliorer la couleur des étoiles
            $('.cpf-benefits-banner svg[style*="color: #FFD700"]').css({
                'color': '#FFD700',
                'filter': 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1))'
            });
            
            // Styler le compteur de devis existant au lieu d'en ajouter un nouveau
            $('.cpf-text-center.cpf-mt-3.cpf-text-sm').css({
                'text-align': 'center',
                'font-size': '0.8rem',
                'color': '#10b981',
                'margin-top': '0.75rem',
                'font-weight': '500'
            });
            
            // Ajouter une bordure supérieure colorée à la bannière
            if (!$('.cpf-benefits-banner').find('.banner-top-border').length) {
                $('.cpf-benefits-banner').prepend('<div class="banner-top-border"></div>');
                $('.banner-top-border').css({
                    'position': 'absolute',
                    'top': '0',
                    'left': '0',
                    'width': '100%',
                    'height': '3px',
                    'background': 'linear-gradient(90deg, #e52d27, #10b981)'
                });
            }
            
            // Ajuster la taille des titres en mobile
            $('.cpf-text-xl').css({
                'font-size': '1.25rem'
            });
            
            $('.cpf-text-lg').css({
                'font-size': '1.125rem'
            });
            
            // Optimiser la barre de progression en mobile
            $('.cpf-progress-bar').css({
                'margin': '0.75rem 0',
                'height': '0.35rem'
            });
            
            // Réduire l'espacement entre les étapes
            $('.cpf-steps-indicator').css({
                'margin-bottom': '0.75rem'
            });
            
            // Optimiser les étapes en mobile
            $('.cpf-step-number').css({
                'width': '2rem',
                'height': '2rem',
                'font-size': '0.875rem'
            });
            
            $('.cpf-step-info').css({
                'font-size': '0.75rem'
            });
        }
        
        // Correctifs pour iOS
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            // Corriger les problèmes de débordement spécifiques à iOS
            $('.cpf-form-input, .cpf-form-textarea, .cpf-form-select').css({
                '-webkit-appearance': 'none',  // Évite les styles par défaut d'iOS
                'border-radius': '0.75rem'
            });
            
            // Corriger les problèmes de zoom sur les champs
            $('input, select, textarea').css({
                'font-size': '16px'  // Évite le zoom automatique sur iOS
            });
        }
        
        // Styles spécifiques pour les smartphones (< 480px)
       // Styles spécifiques pour les smartphones (< 480px)
if (window.innerWidth < 480) {
    // Conteneur principal en version smartphone
    $('.cpf-container').css({
        'padding': '1rem',
        'border-radius': '0.5rem'
    });

    // Réduire davantage l'espacement
    $('.cpf-form-section').css({
        'padding': '1rem',
        'margin-bottom': '1.25rem'
    });

    $('.cpf-benefits-banner').css({
        'padding': '1rem',
        'margin-bottom': '1.25rem'
    });

    // Optimiser les éléments de bénéfice pour très petits écrans
    $('.cpf-benefit-icon').css({
        'width': '1.75rem',
        'height': '1.75rem',
        'margin-right': '0.35rem'
    });

    $('.cpf-benefit-item p').css({
        'font-size': '0.7rem'
    });

    $('.cpf-benefit-icon svg').css({
        'width': '14px',
        'height': '14px'
    });

    // Ajuster la taille des textes
    $('.cpf-text-xl').css({
        'font-size': '1.125rem'
    });

    $('.cpf-text-lg').css({
        'font-size': '1rem'
    });

    // Optimiser les étapes pour très petits écrans
    $('.cpf-steps-indicator').css({
        'gap': '0.5rem'
    });

    $('.cpf-step-number').css({
        'width': '1.75rem',
        'height': '1.75rem',
        'font-size': '0.75rem',
        'margin-bottom': '0.5rem'
    });

    $('.cpf-step-info').css({
        'font-size': '0.75rem'
    });
} 
    // Boutons en version mobile
    $('.cpf-form-buttons').css({
        'flex-direction': 'column',
        'gap': '0.75rem',
        'width': '100%'
    });
    
    $('.cpf-btn').css({
        'width': '100%',
        'margin': '0.25rem 0',
        'padding': '0.75rem 1rem'
    });
    
    // Ajuster l'espacement des sections en mobile
    $('.cpf-form-section').css({
        'padding': '0.75rem 1rem',
        'margin-bottom': '1rem'
    });
    
    // Optimiser les titres des sections
    $('.cpf-form-section h3').css({
        'margin-bottom': '0.5rem'
    });
    
    // Réduire l'espacement entre les champs
    $('.cpf-form-section .cpf-form-group').css({
        'margin-bottom': '0.5rem'
    });
    
    // Bannière de bénéfices en version mobile - style amélioré
    $('.cpf-benefits-banner').css({
        'padding': '1rem 1.25rem',
        'margin-bottom': '1.25rem',
        'background': 'linear-gradient(145deg, #ffffff, #f9fafb)',
        'border': 'none',
        'border-radius': '1rem',
        'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.04)',
        'position': 'relative',
        'overflow': 'hidden'
    });
    
    // Améliorer le titre de la bannière
    $('.cpf-benefits-banner h3').css({
        'font-size': '0.9rem',
        'margin-bottom': '0.75rem',
        'color': '#374151',
        'font-weight': '600',
        'text-align': 'center'
    });
    
    // Améliorer l'affichage des étoiles et de la note
    $('.cpf-benefits-banner .cpf-flex.cpf-items-center.cpf-mb-3').css({
        'display': 'flex',
        'justify-content': 'center',
        'margin-bottom': '1rem',
        'background': 'linear-gradient(145deg, #fffaf0, #fff8e6)',
        'padding': '0.5rem 0.75rem',
        'border-radius': '0.75rem',
        'width': 'fit-content',
        'margin-left': 'auto',
        'margin-right': 'auto'
    });
    
    // Améliorer la couleur des étoiles
    $('.cpf-benefits-banner svg[style*="color: #FFD700"]').css({
        'color': '#FFD700',
        'filter': 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1))'
    });
    
    // Styler le compteur de devis existant au lieu d'en ajouter un nouveau
    $('.cpf-text-center.cpf-mt-3.cpf-text-sm').css({
        'text-align': 'center',
        'font-size': '0.8rem',
        'color': '#10b981',
        'margin-top': '0.75rem',
        'font-weight': '500'
    });
    
    // Ajouter une bordure supérieure colorée à la bannière
    if (!$('.cpf-benefits-banner').find('.banner-top-border').length) {
        $('.cpf-benefits-banner').prepend('<div class="banner-top-border"></div>');
        $('.banner-top-border').css({
            'position': 'absolute',
            'top': '0',
            'left': '0',
            'width': '100%',
            'height': '3px',
            'background': 'linear-gradient(90deg, #e52d27, #10b981)'
        });
    }
    
    // Ajuster la taille des titres en mobile
    $('.cpf-text-xl').css({
        'font-size': '1.25rem'
    });
    
    $('.cpf-text-lg').css({
        'font-size': '1.125rem'
    });
    
    // Optimiser la barre de progression en mobile
    $('.cpf-progress-bar').css({
        'margin': '0.75rem 0',
        'height': '0.35rem'
    });
    
    // Réduire l'espacement entre les étapes
    $('.cpf-steps-indicator').css({
        'margin-bottom': '0.75rem'
    });
    
    // Optimiser les étapes en mobile
    $('.cpf-step-number').css({
        'width': '2rem',
        'height': '2rem',
        'font-size': '0.875rem'
    });
    
    $('.cpf-step-info').css({
        'font-size': '0.75rem'
    });
}

// Fonction pour appliquer les styles mobiles
function applyMobileStyles() {
    // Correctifs pour iOS
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        // Corriger les problèmes de débordement spécifiques à iOS
        $('.cpf-form-input, .cpf-form-textarea, .cpf-form-select').css({
            '-webkit-appearance': 'none',  // Évite les styles par défaut d'iOS
            'border-radius': '0.75rem'
        });
        
        // Corriger les problèmes de zoom sur les champs
        $('input, select, textarea').css({
            'font-size': '16px'  // Évite le zoom automatique sur iOS
        });
    }
    
    // Styles spécifiques pour les smartphones (< 480px)
    if (window.innerWidth < 480) {
        // Conteneur principal en version smartphone
        $('.cpf-container').css({
            'padding': '1rem',
            'border-radius': '0.5rem'
        });
        
        // Réduire davantage l'espacement
        $('.cpf-form-section').css({
            'padding': '1rem',
            'margin-bottom': '1.25rem'
        });
        
        $('.cpf-benefits-banner').css({
            'padding': '1rem',
            'margin-bottom': '1.25rem'
        });
        
        // Optimiser les éléments de bénéfice pour très petits écrans
        $('.cpf-benefit-icon').css({
            'width': '1.75rem',
            'height': '1.75rem',
            'margin-right': '0.35rem'
        });
        
        $('.cpf-benefit-item p').css({
            'font-size': '0.7rem'
        });
        
        $('.cpf-benefit-icon svg').css({
            'width': '14px',
            'height': '14px'
        });
        
        // Ajuster la taille des textes
        $('.cpf-text-xl').css({
            'font-size': '1.125rem'
        });
        
        $('.cpf-text-lg').css({
            'font-size': '1rem'
        });
        
        // Optimiser les étapes pour très petits écrans
        $('.cpf-steps-indicator').css({
            'gap': '0.5rem'
        });
        
        $('.cpf-step-number').css({
            'width': '1.75rem',
            'height': '1.75rem',
            'font-size': '0.75rem',
            'margin-bottom': '0.5rem'
        });
    }
}

// Nettoyer les doublons de compteur de devis avant d'appliquer les styles
function cleanupDuplicateCounters() {
    // Garder uniquement le premier compteur de devis
    var devisCounters = $('.cpf-text-center.cpf-mt-3.cpf-text-sm');
    if (devisCounters.length > 1) {
        devisCounters.not(':first').remove();
    }
    
    // Supprimer les compteurs ajoutés dynamiquement
    $('.cpf-devis-count').remove();
}

// Nettoyer d'abord
cleanupDuplicateCounters();

// Appliquer les styles ensuite
applyCustomStyles();
applyMobileStyles();

// Réappliquer les styles après un court délai pour s'assurer que tout est chargé
setTimeout(function() {
    cleanupDuplicateCounters();
    applyCustomStyles();
    applyMobileStyles();
}, 500);

// Appliquer les styles mobiles lors du redimensionnement de la fenêtre
$(window).resize(function() {
    applyCustomStyles();
    applyMobileStyles();
});

// S'assurer que les styles sont appliqués après le chargement complet
$(window).on('load', function() {
    applyCustomStyles();
    applyMobileStyles();
    
    // Réappliquer après un court délai pour s'assurer que tout est chargé
    setTimeout(function() {
        applyCustomStyles();
        applyMobileStyles();
    }, 500);
    
    // S'assurer que les styles sont appliqués après le chargement complet
    $(window).on('load', function() {
        applyCustomStyles();
        applyMobileStyles();
        
        // Réappliquer après un court délai pour s'assurer que tout est chargé
        setTimeout(function() {
            applyCustomStyles();
            applyMobileStyles();
        }, 500);
    });
    
    // Ajouter des animations CSS
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        @keyframes shimmer {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes slideUp {
            0% { opacity: 0; transform: translateY(30px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
            0% { opacity: 0; transform: scale(0.8); }
            50% { opacity: 0.5; transform: scale(1.2); }
            100% { opacity: 0; transform: scale(0.8); }
        }
        
        .cpf-btn:after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.1);
            transform: scaleX(0);
            transform-origin: right;
            transition: transform 0.5s ease;
            z-index: -1;
        }
        
        .cpf-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        
        .cpf-btn:hover:after {
            transform: scaleX(1);
            transform-origin: left;
        }
        
        .cpf-form-input:hover,
        .cpf-form-textarea:hover,
        .cpf-form-select:hover {
            border-color: #d1d5db;
            background-color: white;
        }
        
        .cpf-form-input:focus,
        .cpf-form-textarea:focus,
        .cpf-form-select:focus {
            border-color: #e52d27;
            background-color: white;
            outline: none;
            box-shadow: 0 0 0 4px rgba(229, 45, 39, 0.1), inset 0 2px 4px rgba(0, 0, 0, 0);
        }
        
        .cpf-benefit-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
            background-color: white;
            border-color: #e5e7eb;
        }
        
        .cpf-form-section:hover {
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.05), 0 5px 15px rgba(0, 0, 0, 0.05);
            transform: translateY(-2px);
        }
        
        #cpf-success-message {
            animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
    `;
    document.head.appendChild(styleElement);
});
