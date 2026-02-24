// src/app/services/gemini-ai.service.ts

import { Injectable, signal, Inject, PLATFORM_ID, inject as angularInject } from '@angular/core';
import { Observable, from, map, catchError, of } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http'; // AJOUTER CET IMPORT
import { AIExplanation, CodeExample } from '../models/asvs.models';

@Injectable({
  providedIn: 'root'
})
export class GeminiAiService {
  private cache = new Map<string, AIExplanation>();
  public isLoading = signal(false);
  public error = signal<string | null>(null);
  private platformId = angularInject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  
  // AJOUTER CES LIGNES
  private apiUrl = '/api/gemini'; // URL de votre backend proxy
  private http = angularInject(HttpClient); // Injecter HttpClient

  // Modèles qui fonctionnent avec la version gratuite (février 2025)
  private readonly FREE_MODELS = [
    'gemini-3-flash-preview',  // Modèle expérimental gratuit
  ];

  private currentModelIndex = 0;
  private requestCount = 0;
  private lastRequestTime = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 60; // Limite gratuite

  constructor() {
    // PLUS BESOIN d'initialiser GoogleGenAI ici !
    console.log('GeminiAiService prêt avec proxy backend');
  }

  getExplanation(requirement: string, requirementId: string, technology: string): Observable<AIExplanation | null> {
    if (!this.isBrowser) {
      return of(this.getDefaultExplanation(requirementId, technology));
    }

    // Vérifier le quota (optionnel, peut être géré côté backend)
    if (!this.checkQuota()) {
      this.error.set('Limite de requêtes atteinte. Veuillez patienter quelques secondes.');
      return of(this.getQuotaExceededExplanation(requirementId, technology));
    }

    const cacheKey = `${requirementId}-${technology}`;
    
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey)!);
    }

    this.isLoading.set(true);
    this.error.set(null);

    const prompt = this.buildPrompt(requirement, technology);
    
    // MODIFIER CETTE PARTIE - Utiliser HttpClient au lieu de GoogleGenAI
    return this.http.post(this.apiUrl, {
      prompt,
      model: this.getCurrentModel()
    }).pipe(
      map((response: any) => {
        // Extraire le texte de la réponse
        let text = '';
        if (response.candidates && response.candidates[0]?.content?.parts[0]?.text) {
          text = response.candidates[0].content.parts[0].text;
        } else if (response.text) {
          text = response.text;
        } else {
          text = JSON.stringify(response);
        }
        
        const explanation = this.parseResponse(text, requirementId, technology);
        this.cache.set(cacheKey, explanation);
        this.isLoading.set(false);
        return explanation;
      }),
      catchError(error => {
        console.error('Erreur proxy Gemini:', error);
        
        let errorMessage = 'Erreur de connexion au serveur';
        if (error.error?.error) {
          errorMessage = error.error.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.error.set(errorMessage);
        this.isLoading.set(false);
        return of(this.getDefaultExplanation(requirementId, technology));
      })
    );
  }

  private checkQuota(): boolean {
    const now = Date.now();
    if (now - this.lastRequestTime > 60000) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }
    
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    this.requestCount++;
    return true;
  }

  // SUPPRIMER la méthode generateContentWithFallback - plus besoin !
  // Elle est remplacée par l'appel HTTP ci-dessus

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCachedExplanation(requirementId: string, technology: string): AIExplanation | null {
    const cacheKey = `${requirementId}-${technology}`;
    return this.cache.get(cacheKey) || null;
  }

  setModel(modelName: string) {
    const index = this.FREE_MODELS.indexOf(modelName);
    if (index !== -1) {
      this.currentModelIndex = index;
      this.clearCache();
      console.log('Modèle changé pour:', modelName);
    }
  }

  getCurrentModel(): string {
    return this.FREE_MODELS[this.currentModelIndex] || this.FREE_MODELS[0];
  }

  getWorkingModels(): string[] {
    return this.FREE_MODELS;
  }

  private getQuotaExceededExplanation(requirementId: string, technology: string): AIExplanation {
    return {
      requirementId,
      technology,
      explanation: `⚠️ Limite de requêtes gratuites atteinte pour l'API Gemini.

**Que s'est-il passé ?**
Vous avez atteint la limite de 60 requêtes par minute de la version gratuite.

**Comment résoudre ce problème ?**
1. ⏱️ Attendez 60 secondes avant de réessayer
2. 🔄 Utilisez les réponses en cache (certaines explications sont déjà sauvegardées)

**Recommandations OWASP pour ${technology} :**
- Consultez la documentation officielle OWASP
- Vérifiez les bonnes pratiques de sécurité pour ${technology}`,
      risks: ['Information temporairement indisponible - limite de quota'],
      implementationSteps: [
        'Attendez 60 secondes et réessayez',
        'Consultez la documentation OWASP directement'
      ],
      codeExamples: [],
      bestPractices: [
        'Planifiez vos validations de sécurité',
        'Utilisez des outils de scan automatiques'
      ]
    };
  }

  private getDefaultExplanation(requirementId: string, technology: string): AIExplanation {
    return {
      requirementId,
      technology,
      explanation: `Explication temporairement indisponible pour ${technology}. 

**Modèles disponibles actuellement:** ${this.FREE_MODELS.join(', ')}

**Conseil:** Réessayez dans quelques instants ou consultez directement la documentation OWASP ASVS.`,
      risks: ['Information temporairement indisponible'],
      implementationSteps: [
        'Vérifiez votre connexion internet',
        'Consultez la documentation OWASP officielle'
      ],
      codeExamples: [],
      bestPractices: [
        'Implémentez les contrôles de sécurité recommandés',
        'Effectuez des revues de code régulières'
      ]
    };
  }

  private buildPrompt(requirement: string, technology: string): string {
    return `En tant qu'expert en sécurité des applications ${technology}, explique cette recommandation OWASP:

"${requirement}"

Fournis une réponse structurée avec:

EXPLANATION: Une explication claire et détaillée de cette recommandation pour ${technology}

RISKS: Liste des risques de sécurité si non implémentée (séparés par |)

STEPS: Étapes d'implémentation pratiques pour ${technology} (séparées par |)

CODE_EXAMPLES: Exemples de code avec le format: langage:description:code (séparés par ||)

BEST_PRACTICES: Bonnes pratiques spécifiques à ${technology} (séparées par |)`;
  }

  private parseResponse(text: string, requirementId: string, technology: string): AIExplanation {
    try {
      return {
        requirementId,
        technology,
        explanation: this.extractSection(text, 'EXPLANATION'),
        risks: this.extractList(text, 'RISKS'),
        implementationSteps: this.extractList(text, 'STEPS'),
        codeExamples: this.extractCodeExamples(text),
        bestPractices: this.extractList(text, 'BEST_PRACTICES')
      };
    } catch (e) {
      console.error('Erreur de parsing:', e);
      return this.getDefaultExplanation(requirementId, technology);
    }
  }

  private extractSection(text: string, section: string): string {
    const regex = new RegExp(`${section}:?\\s*([\\s\\S]*?)(?=\\n\\w+:|$)`);
    const match = text.match(regex);
    return match ? match[1].trim() : 'Section non disponible';
  }

  private extractList(text: string, section: string): string[] {
    const sectionText = this.extractSection(text, section);
    if (sectionText === 'Section non disponible') return [];
    
    return sectionText.split('|')
      .map(item => item.trim())
      .filter(item => item && item !== 'Section non disponible');
  }

  private extractCodeExamples(text: string): CodeExample[] {
    const examples: CodeExample[] = [];
    const sectionText = this.extractSection(text, 'CODE_EXAMPLES');
    
    if (sectionText === 'Section non disponible') return examples;

    const examplesList = sectionText.split('||');
    
    for (const example of examplesList) {
      const parts = example.split(':');
      if (parts.length >= 3) {
        examples.push({
          language: parts[0].trim(),
          description: parts[1].trim(),
          code: parts.slice(2).join(':').trim()
        });
      }
    }
    
    return examples;
  }

  clearCache(): void {
    this.cache.clear();
  }
}