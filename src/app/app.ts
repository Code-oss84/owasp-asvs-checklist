// src/app/app.component.ts - VERSION CORRIGÉE

import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AsvsService } from './services/asvs';
import { GeminiAiService } from './services/gemini-ai';
import { ASVSRequirement, AIExplanation } from './models/asvs.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    FormsModule,
    HttpClientModule
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  // Injection des services
  private asvsService = inject(AsvsService);
  private geminiService = inject(GeminiAiService);
  private decimalPipe = inject(DecimalPipe);
  private datePipe = inject(DatePipe);

  // Signaux
  title = signal('OWASP ASVS Security Checklist');
  selectedRequirement = signal<ASVSRequirement | null>(null);
  selectedTechnology = signal('Angular');
  aiExplanation = signal<AIExplanation | null>(null);
  searchTerm = signal('');
  selectedLevel = signal<number | null>(null);
  
  technologies = ['Angular', 'React', 'Vue', 'Node.js', 'Java Spring', 'Python Django', '.NET Core', 'Flask'];
  levels = [1, 2, 3];

  // Signaux publics depuis les services
  public readonly categories = this.asvsService.categories;
  public readonly validations = this.asvsService.validations;
  public readonly isLoading = this.geminiService.isLoading;
  public readonly aiError = this.geminiService.error;

  // Message de validation (propriété normale, PAS un signal)
  validationMessage = '';

  // Recherche filtrée
  public readonly filteredRequirements = computed(() => {
  const search = this.searchTerm().toLowerCase();
  const level = this.selectedLevel(); // level est un nombre (1, 2, 3) ou null
  const allReqs = this.asvsService.requirements();
  
  return allReqs.filter(req => {
    const matchesSearch = !search || 
      req['Verification Requirement']?.toLowerCase().includes(search) ||
      req['#']?.toLowerCase().includes(search) ||
      req.Area?.toLowerCase().includes(search);
    
    // Gérer le cas où req['ASVS Level'] peut être string ou number
    let matchesLevel = true;
    if (level !== null) {
      const reqLevel = req['ASVS Level'];
      // Convertir en nombre si c'est une string
      const reqLevelNum = typeof reqLevel === 'string' ? parseInt(reqLevel, 10) : reqLevel;
      matchesLevel = reqLevelNum === level;
    }
    
    return matchesSearch && matchesLevel;
  });
});
  // Statistiques globales
  public readonly stats = computed(() => {
    const reqs = this.asvsService.requirements();
    const total = reqs.length;
    const valid = Object.values(this.validations()).filter(v => v?.status === 'Valid').length;
    const invalid = Object.values(this.validations()).filter(v => v?.status === 'Invalid').length;
    const notApplicable = Object.values(this.validations()).filter(v => v?.status === 'Not Applicable').length;
    
    return {
      total,
      valid,
      invalid,
      notApplicable,
      progress: total > 0 ? (valid / total) * 100 : 0
    };
  });

  ngOnInit() {
    // Charger tous les fichiers au lieu d'un seul
    this.asvsService.loadAllChecklists().subscribe({
      next: (data) => {
        console.log('Toutes les catégories chargées:', data.length);
        this.checkLoadedCategories();
      },
      error: (err) => {
        console.error('Erreur de chargement:', err);
      }
    });
  }

  checkLoadedCategories() {
    const categories = this.asvsService.categories();
    console.log('Catégories chargées:', categories.map(c => ({
      name: c.name,
      count: c.totalCount
    })));
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  onLevelSelect(level: number) {
  // Bascule entre le niveau sélectionné et null
  this.selectedLevel.set(this.selectedLevel() === level ? null : level);
  console.log('Niveau sélectionné:', level);
  console.log('Nombre d\'exigences filtrées:', this.filteredRequirements().length);
}
  // Obtenir le modèle actuel
  getCurrentModel(): string {
    return this.geminiService.getCurrentModel();
  }

  // Changer de modèle
  changeModel(event: Event) {
    const select = event.target as HTMLSelectElement;
    const modelName = select.value;
    this.geminiService.setModel(modelName);
    
    const req = this.selectedRequirement();
    if (req) {
      this.loadAIExplanation(req);
    }
  }

  setModelByIndex(index: number) {
    const models = this.geminiService.getWorkingModels();
    if (index >= 0 && index < models.length) {
      this.geminiService.setModel(models[index]);
      
      const req = this.selectedRequirement();
      if (req) {
        this.loadAIExplanation(req);
      }
    }
  }

  onTechnologyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedTechnology.set(select.value);
    const req = this.selectedRequirement();
    if (req) {
      this.loadAIExplanation(req);
    }
  }

  // Ces méthodes sont appelées par le template mais ne font rien
  onStatusChange(event: Event) {
    // Optionnel - peut être supprimé si vous enlevez les appels du template
  }

  onCommentChange(event: Event) {
    // Optionnel - peut être supprimé si vous enlevez les appels du template
  }

  selectRequirement(requirement: ASVSRequirement) {
    this.selectedRequirement.set(requirement);
    this.loadAIExplanation(requirement);
  }

  loadAIExplanation(requirement: ASVSRequirement) {
    if (!requirement['Verification Requirement']) return;

    this.geminiService.getExplanation(
      requirement['Verification Requirement'],
      requirement['#'] || '',
      this.selectedTechnology()
    ).subscribe(explanation => {
      this.aiExplanation.set(explanation);
    });
  }

  // UNE SEULE méthode updateValidation
  updateValidation(status: string, comment: string) {
    const req = this.selectedRequirement();
    if (!req || !req['#']) return;

    this.asvsService.updateValidation(
      req['#'],
      status as 'Valid' | 'Invalid' | 'Not Applicable',
      comment
    );

    this.validationMessage = `✓ Validation enregistrée: ${status}`;
    
    setTimeout(() => {
      this.validationMessage = '';
    }, 3000);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return this.datePipe.transform(date, 'short') || '';
  }

  getStatusBadgeClass(status?: string): string {
    switch(status) {
      case 'Valid': return 'bg-green-100 text-green-800 border-green-200';
      case 'Invalid': return 'bg-red-100 text-red-800 border-red-200';
      case 'Not Applicable': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  }

  getLevelBadgeClass(level: number): string {
    switch(level) {
      case 1: return 'bg-green-100 text-green-700';
      case 2: return 'bg-yellow-100 text-yellow-700';
      case 3: return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  formatProgress(progress: number): string {
    return this.decimalPipe.transform(progress, '1.0-0') || '0';
  }

  clearSelection() {
    this.selectedRequirement.set(null);
    this.aiExplanation.set(null);
  }

  resetValidations() {
    if (confirm('Voulez-vous vraiment réinitialiser toutes les validations ?')) {
      this.asvsService.resetValidations();
    }
  }
}