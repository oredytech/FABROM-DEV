# Guide d'intégration Cloudinary - FABROM

## 🎯 Vue d'ensemble

FABROM intègre maintenant Cloudinary pour gérer toutes les images uploadées par les utilisateurs de manière sécurisée et performante.

## 🔐 Sécurité

### Secrets configurés

Les clés API Cloudinary sont stockées de manière sécurisée dans les secrets Supabase :
- `CLOUDINARY_CLOUD_NAME`: dxm6iuobv
- `CLOUDINARY_API_KEY`: 873592358721453  
- `CLOUDINARY_API_SECRET`: (masqué pour la sécurité)

**⚠️ Important**: Ces secrets ne sont JAMAIS exposés côté client. Tous les uploads passent par une edge function sécurisée.

## 📤 Fonctionnement de l'upload

### 1. Upload d'images par l'utilisateur

```typescript
// L'utilisateur clique sur le bouton "📷"
// Les images sont automatiquement uploadées vers Cloudinary
// L'URL Cloudinary est retournée et stockée localement
```

### 2. Flux de données

```
Utilisateur → ChatInterface → Edge Function (upload-to-cloudinary) → Cloudinary API → URL sécurisée
```

### 3. Analyse par l'IA

L'assistant AI peut :
- ✅ Analyser le contenu des images
- ✅ Générer des descriptions pertinentes (alt text)
- ✅ Suggérer la meilleure intégration dans le code
- ✅ Créer du code HTML responsive avec les URLs Cloudinary

## 💻 Utilisation dans le code

### HTML généré par l'assistant

```html
<!-- L'assistant génère automatiquement ce type de code -->
<img 
  src="https://res.cloudinary.com/dxm6iuobv/image/upload/v1234567890/fabrom-uploads/image.jpg" 
  alt="Description générée par l'IA"
  class="responsive-image"
  loading="lazy"
>
```

### CSS responsive automatique

L'assistant ajoute automatiquement des styles responsive :

```css
.responsive-image {
  max-width: 100%;
  height: auto;
  object-fit: cover;
}
```

## 🌐 Permissions et domaines

### Domaines autorisés

L'application est configurée pour fonctionner depuis :
- ✅ localhost (développement)
- ✅ fabrom.net (production)
- ✅ *.lovable.app (preview)

### File System Access API

Le navigateur demande automatiquement les permissions nécessaires pour :
- Lire les fichiers du projet
- Écrire les fichiers générés
- Accéder aux dossiers de travail

## 📊 Fonctionnalités avancées

### Transformations Cloudinary

Les utilitaires dans `src/utils/cloudinary.ts` permettent :

```typescript
// Images responsives avec multiple tailles
generateResponsiveImageTag(imageData, "Description", "css-class");

// Images de fond optimisées
generateBackgroundImage(url, 1920, 1080);

// Extraction de couleurs dominantes
getImageWithColors(url);
```

### Optimisations automatiques

Cloudinary applique automatiquement :
- 🎨 Compression intelligente
- 📐 Redimensionnement adaptatif
- ⚡ Format optimal (WebP, AVIF)
- 🖼️ Lazy loading
- 📱 Responsive images

## 🚀 Workflow recommandé

1. **Upload des images**
   - Cliquez sur le bouton 📷 dans le chat
   - Sélectionnez vos images
   - Attendez la confirmation d'upload vers Cloudinary

2. **Demandez à l'assistant**
   ```
   "Intègre ces images dans une galerie responsive"
   "Crée une hero section avec la première image"
   "Analyse ces images et suggère une mise en page"
   ```

3. **L'assistant génère**
   - Code HTML complet avec URLs Cloudinary
   - CSS responsive adapté
   - JavaScript si nécessaire pour l'interactivité

## 🔧 Maintenance

### Monitoring des uploads

Les logs sont disponibles dans :
- Console du navigateur (développement)
- Logs Supabase Edge Functions (production)

### Gestion des erreurs

Les erreurs communes et leurs solutions :
- **"Cloudinary configuration error"**: Vérifier que les secrets sont bien configurés
- **"Upload failed"**: Vérifier la connexion internet et la taille du fichier
- **"Permission denied"**: S'assurer que le navigateur autorise l'API File System Access

## 📝 Notes importantes

### Limites

- Taille max par image : 10MB (configurable)
- Formats supportés : JPG, PNG, GIF, WebP, SVG
- Stockage : illimité (selon le plan Cloudinary)

### Best practices

1. ✅ Toujours utiliser les URLs Cloudinary générées
2. ✅ Laisser l'assistant analyser les images
3. ✅ Utiliser les transformations pour optimiser
4. ✅ Ajouter des alt text descriptifs
5. ✅ Utiliser le lazy loading pour les performances

## 🆘 Support

Pour toute question ou problème :
1. Vérifier les logs de l'edge function
2. Consulter la console du navigateur
3. Tester avec une image plus petite
4. Contacter le support Cloudinary si nécessaire

---

**Dernière mise à jour**: $(date)
**Version**: 1.0.0
**Cloud Provider**: Cloudinary (dxm6iuobv)
