// import { HttpClient } from '@angular/common/http';
// import { Injectable } from '@angular/core';

// @Injectable({
//   providedIn: 'root',
// })
// export class Asvs {

//   constructor(private http: HttpClient) {}
//    getChecklist() {
//     return this.http.get<any[]>('assets/data/Architecture.json');
//   }
// }
// src/app/services/asvs.service.ts

// src/app/services/asvs.service.ts

// import { Injectable, signal, computed, Inject, PLATFORM_ID, inject as angularInject } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
// import { Observable, tap } from 'rxjs';
// import { isPlatformBrowser, isPlatformServer } from '@angular/common';
// import { ASVSRequirement, ASVSCategory, ValidationState } from '../models/asvs.models';

// @Injectable({
//   providedIn: 'root'
// })
// export class AsvsService {
//   private allRequirements = signal<ASVSRequirement[]>([]);
//   private validationState = signal<ValidationState>({});
//   private platformId = angularInject(PLATFORM_ID);
  
//   // Vérifier si on est dans le navigateur
//   private isBrowser = isPlatformBrowser(this.platformId);

//   public readonly requirements = this.allRequirements.asReadonly();
//   public readonly validations = this.validationState.asReadonly();

//   public readonly categories = computed(() => {
//     const reqs = this.allRequirements();
//     const categories = [...new Set(reqs.map(r => r.Area).filter(Boolean))];

//     return categories.map(catName => {
//       const catReqs = reqs.filter(r => r.Area === catName);
//       const totalCount = catReqs.length;
//       const validCount = catReqs.filter(r => 
//         this.validationState()[r['#'] || '']?.status === 'Valid'
//       ).length;

//       return {
//         name: catName,
//         requirements: catReqs,
//         totalCount,
//         validCount,
//         progress: totalCount > 0 ? (validCount / totalCount) * 100 : 0
//       };
//     });
//   });

//   constructor(private http: HttpClient) {
//     // Ne charger que côté navigateur
//     if (this.isBrowser) {
//       this.loadFromLocalStorage();
//     }
//   }

//   getChecklist(): Observable<ASVSRequirement[]> {
//     return this.http.get<ASVSRequirement[]>('assets/data/Architecture.json').pipe(
//       tap(data => {
//         console.log('Données reçues:', data);
//         this.allRequirements.set(data);
//       })
//     );
//   }

//   updateValidation(id: string, status: 'Valid' | 'Invalid' | 'Not Applicable', comment: string): void {
//     if (!this.isBrowser) return; // Ne pas exécuter côté serveur
    
//     this.validationState.update(state => ({
//       ...state,
//       [id]: { status, comment, date: new Date() }
//     }));
//     this.saveToLocalStorage();
//   }

//   getValidationStatus(id: string) {
//     return this.validationState()[id];
//   }

//   private saveToLocalStorage(): void {
//     if (!this.isBrowser) return;
    
//     try {
//       localStorage.setItem('asvs-validations', JSON.stringify(this.validationState()));
//     } catch (e) {
//       console.error('Erreur lors de la sauvegarde:', e);
//     }
//   }

//   private loadFromLocalStorage(): void {
//     if (!this.isBrowser) return;
    
//     try {
//       const saved = localStorage.getItem('asvs-validations');
//       if (saved) {
//         const parsed = JSON.parse(saved);
//         // Convertir les dates string en objets Date
//         Object.keys(parsed).forEach(key => {
//           if (parsed[key].date) {
//             parsed[key].date = new Date(parsed[key].date);
//           }
//         });
//         this.validationState.set(parsed);
//       }
//     } catch (e) {
//       console.error('Erreur de chargement des validations', e);
//     }
//   }

//   resetValidations(): void {
//     if (!this.isBrowser) return;
    
//     this.validationState.set({});
//     try {
//       localStorage.removeItem('asvs-validations');
//     } catch (e) {
//       console.error('Erreur lors de la réinitialisation:', e);
//     }
//   }
// }

// src/app/services/asvs.service.ts

import { Injectable, signal, computed, Inject, PLATFORM_ID, inject as angularInject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { ASVSRequirement, ASVSCategory, ValidationState } from '../models/asvs.models';

@Injectable({
  providedIn: 'root'
})
export class AsvsService {
  private allRequirements = signal<ASVSRequirement[]>([]);
  private validationState = signal<ValidationState>({});
  private platformId = angularInject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private readonly jsonFiles = [
    'Architecture.json',
    'Authentication.json',
    'SessionManagement.json',
    'AccessControl.json',
    'InputValidation.json',
    'Cryptography.json',
    'ErrorHandling.json',
    'DataProtection.json',
    'CommunicationSecurity.json',
    'MaliciousCode.json',
    'BusinessLogic.json',
    'FilesAndResources.json',
    'APIWebService.json',
    'Configuration.json'
  ];

  public readonly requirements = this.allRequirements.asReadonly();
  public readonly validations = this.validationState.asReadonly();

  public readonly categories = computed(() => {
    const reqs = this.allRequirements();
    const categories = [...new Set(reqs.map(r => r.Area).filter(Boolean))] as string[];

    return categories
      .map(catName => {
        const catReqs = reqs.filter(r => r.Area === catName);
        const totalCount = catReqs.length;
        const validCount = catReqs.filter(r => 
          this.validationState()[r['#'] || '']?.status === 'Valid'
        ).length;

        return {
          name: catName,
          requirements: catReqs,
          totalCount,
          validCount,
          progress: totalCount > 0 ? (validCount / totalCount) * 100 : 0
        };
      })
      .filter(category => category.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  constructor(private http: HttpClient) {
    if (this.isBrowser) {
      this.loadFromLocalStorage();
    }
  }

  loadAllChecklists(): Observable<ASVSRequirement[]> {
    const requests = this.jsonFiles.map(file => 
      this.http.get<ASVSRequirement[]>(`assets/data/${file}`).pipe(
        map(data => {
          console.log(`Chargement de ${file}: ${data.length} éléments`);
          return data.map(item => ({
            ...item,
            category: this.getCategoryFromFile(file)
          }));
        })
      )
    );

    return forkJoin(requests).pipe(
      map(responses => responses.flat()),
      tap(allData => {
        console.log('Total des exigences chargées:', allData.length);
        console.log('Premier élément:', allData[0]);
        console.log('IDs disponibles:', allData.map(d => d['#']).slice(0, 10));
        this.allRequirements.set(allData);
      })
    );
  }

  private getCategoryFromFile(fileName: string): string {
    return fileName.replace('.json', '');
  }

  // Méthode de validation avec logs
  updateValidation(id: string, status: 'Valid' | 'Invalid' | 'Not Applicable', comment: string): void {
    if (!this.isBrowser) return;
    
    console.log('Tentative de mise à jour validation:', { id, status, comment });
    console.log('ID reçu:', id);
    console.log('Type de ID:', typeof id);
    
    // Vérifier si l'ID existe dans les exigences
    const exists = this.allRequirements().some(req => req['#'] === id);
    console.log('ID existe dans les exigences?', exists);
    
    if (!exists) {
      console.warn(`ID ${id} non trouvé dans les exigences!`);
      // Afficher les IDs disponibles pour comparaison
      const availableIds = this.allRequirements().map(r => r['#']).slice(0, 20);
      console.log('IDs disponibles (échantillon):', availableIds);
    }
    
    this.validationState.update(state => {
      const newState = {
        ...state,
        [id]: { status, comment, date: new Date() }
      };
      console.log('Nouvel état de validation:', newState);
      return newState;
    });
    
    this.saveToLocalStorage();
  }

  getValidationStatus(id: string) {
    const status = this.validationState()[id];
    console.log(`Récupération statut pour ${id}:`, status);
    return status;
  }

  private saveToLocalStorage(): void {
    if (!this.isBrowser) return;
    
    try {
      const state = this.validationState();
      console.log('Sauvegarde dans localStorage:', state);
      localStorage.setItem('asvs-validations', JSON.stringify(state));
      
      // Vérifier que la sauvegarde a fonctionné
      const saved = localStorage.getItem('asvs-validations');
      console.log('Vérification sauvegarde:', saved ? 'OK' : 'Échec');
    } catch (e) {
      console.error('Erreur lors de la sauvegarde:', e);
    }
  }

  private loadFromLocalStorage(): void {
    if (!this.isBrowser) return;
    
    try {
      const saved = localStorage.getItem('asvs-validations');
      console.log('Chargement depuis localStorage:', saved);
      
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convertir les dates string en objets Date
        Object.keys(parsed).forEach(key => {
          if (parsed[key].date) {
            parsed[key].date = new Date(parsed[key].date);
          }
        });
        console.log('État chargé:', parsed);
        this.validationState.set(parsed);
      }
    } catch (e) {
      console.error('Erreur de chargement des validations', e);
    }
  }

  resetValidations(): void {
    if (!this.isBrowser) return;
    
    this.validationState.set({});
    try {
      localStorage.removeItem('asvs-validations');
      console.log('Validations réinitialisées');
    } catch (e) {
      console.error('Erreur lors de la réinitialisation:', e);
    }
  }

  // Méthode de débogage
  debugValidation(): void {
    console.log('=== DÉBOGAGE VALIDATION ===');
    console.log('État actuel:', this.validationState());
    console.log('Nombre de validations:', Object.keys(this.validationState()).length);
    console.log('Premières exigences:', this.allRequirements().slice(0, 5).map(r => ({
      id: r['#'],
      area: r.Area
    })));
    console.log('===========================');
  }
}