import { Component, EventEmitter, HostBinding, HostListener, Output, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';
import { BrandingService } from '../../services/branding.service';

@Component({
    selector: 'app-menu',
    templateUrl: './menu.component.html',
    styleUrl: './menu.component.scss',
    standalone: false
})
export class MenuComponent {
  readonly branding: BrandingService;
  collapsed = signal(false);
  mobileOpen = signal(false);
  mobile = signal(typeof window !== 'undefined' && window.innerWidth <= 900);

  @Output() collapsedChange = new EventEmitter<boolean>();

  @HostBinding('class.menu-collapsed')
  get hostCollapsed(): boolean {
    return this.collapsed();
  }

  constructor(
    private rota: Router,
    private authService: AuthService,
    branding: BrandingService,
  ) { this.branding = branding; }
  
  isSystemAdmin = computed(() => this.authService.isSystemAdmin());
  isAdmin = computed(() => this.authService.hasRole('administrador'));
  tenant = this.authService.activeTenantId;

  toggleMenu(): void {
    if (this.isMobileViewport()) {
      this.mobileOpen.update((open) => !open);
      return;
    }

    this.collapsed.update((collapsed) => !collapsed);
    this.collapsedChange.emit(this.collapsed());
  }

  closeMobileMenu(): void {
    this.mobileOpen.set(false);
  }

  @HostListener('window:resize')
  handleResize(): void {
    this.mobile.set(this.isMobileViewport());
    if (!this.isMobileViewport()) {
      this.closeMobileMenu();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeMobileMenu();
  }

  async logout(): Promise<void> {
    const empresa = this.authService.activeTenantId();
    await this.authService.logout();
    await this.rota.navigate(empresa ? ['login', empresa] : ['login']);
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 900;
  }
}
