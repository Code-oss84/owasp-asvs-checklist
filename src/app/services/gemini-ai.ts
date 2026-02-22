// src/app/services/gemini-ai.service.ts

import { Injectable, signal, Inject, PLATFORM_ID, inject as angularInject } from '@angular/core';
import { Observable, from, map, catchError, of } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { GoogleGenAI } from '@google/genai';
import { AIExplanation, CodeExample } from '../models/asvs.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeminiAiService {
  private cache = new Map<string, AIExplanation>();
  public isLoading = signal(false);
  public error = signal<string | null>(null);
  private platformId = angularInject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private genAI: GoogleGenAI | null = null;

  // Modèles qui fonctionnent avec la version gratuite (février 2025)
  private readonly FREE_MODELS = [
    'gemini-3-flash-preview',  // Modèle expérimental gratuit
  ];

  private currentModelIndex = 0;
  private requestCount = 0;
  private lastRequestTime = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 60; // Limite gratuite

  constructor() {
    if (this.isBrowser) {
      try {
        this.genAI = new GoogleGenAI({ apiKey: environment.geminiApiKey });
        console.log('GoogleGenAI initialisé avec succès');
      } catch (error) {
        console.error('Erreur d\'initialisation GoogleGenAI:', error);
        this.error.set('Erreur d\'initialisation du client Gemini');
      }
    }
  }

  getExplanation(requirement: string, requirementId: string, technology: string): Observable<AIExplanation | null> {
    if (!this.isBrowser || !this.genAI) {
      return of(this.getDefaultExplanation(requirementId, technology));
    }

    // Vérifier le quota
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
    
    const promise = this.generateContentWithFallback(prompt);
    
    return from(promise).pipe(
      map((text: string) => {
        const explanation = this.parseResponse(text, requirementId, technology);
        this.cache.set(cacheKey, explanation);
        this.isLoading.set(false);
        return explanation;
      }),
      catchError(error => {
        console.error('Erreur GoogleGenAI:', error);
        
        let errorMessage = 'Erreur de connexion à Gemini';
        if (error && typeof error === 'object') {
          if ('error' in error && error.error && typeof error.error === 'object') {
            errorMessage = (error.error as any).message || errorMessage;
          } else if ('message' in error) {
            errorMessage = (error as any).message;
          }
        }
        
        this.error.set(errorMessage);
        this.isLoading.set(false);
        return of(this.getDefaultExplanation(requirementId, technology));
      })
    );
  }

  private checkQuota(): boolean {
    const now = Date.now();
    // Réinitialiser le compteur toutes les minutes
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

   private async generateContentWithFallback(prompt: string): Promise<string> {
  if (!this.genAI) {
    throw new Error('GoogleGenAI non initialisé');
  }

  let lastError: Error | null = null;

  for (let i = 0; i < this.FREE_MODELS.length; i++) {
    const modelName = this.FREE_MODELS[i];
    
    try {
      console.log(`Tentative avec le modèle: ${modelName}`);
      
      const response = await this.genAI.models.generateContent({  // <-- L'appel API ici
        model:  "gemini-3-flash-preview",
        contents: prompt
      });

        this.currentModelIndex = i;
        
        let text = '';
        if (typeof response === 'string') {
          text = response;
        } else if (response && typeof response === 'object') {
          text = (response as any).text || 
                 (response as any).response || 
                 (response as any).candidates?.[0]?.content?.parts?.[0]?.text ||
                 JSON.stringify(response);
        }

        if (text) {
          console.log(`Succès avec le modèle gratuit: ${modelName}`);
          return text;
        }
      } catch (error: any) {
        console.warn(`Échec avec le modèle ${modelName}:`, error.message);
        lastError = error;
      }
    }

    // Si tous les modèles échouent, proposer une solution de secours
    throw lastError || new Error('Aucun modèle gratuit disponible');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Version simplifiée qui utilise un cache local
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
3. 💳 Passez à un compte payant pour plus de requêtes

**Recommandations OWASP pour ${technology} :**
- Consultez la documentation officielle OWASP
- Vérifiez les bonnes pratiques de sécurité pour ${technology}
- Testez manuellement les contrôles de sécurité`,
      risks: ['Information temporairement indisponible - limite de quota'],
      implementationSteps: [
        'Attendez 60 secondes et réessayez',
        'Consultez la documentation OWASP directement',
        'Utilisez les ressources de la communauté'
      ],
      codeExamples: [],
      bestPractices: [
        'Planifiez vos validations de sécurité',
        'Utilisez des outils de scan automatiques',
        'Documentez vos contrôles de sécurité'
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
        'Consultez la documentation OWASP officielle',
        'Utilisez les ressources de sécurité de votre framework'
      ],
      codeExamples: [],
      bestPractices: [
        'Implémentez les contrôles de sécurité recommandés',
        'Effectuez des revues de code régulières',
        'Utilisez des outils d\'analyse statique'
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